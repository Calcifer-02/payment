import express, { Request, Response } from 'express';
import cors from 'cors';
import {ICreatePayment, YooCheckout} from '@a2seven/yoo-checkout';
import dotenv from 'dotenv';

dotenv.config();

const database: any = {

}

const app = express();
const PORT = Number(process.env.PORT) || 4001;

app.use(cors({
    credentials: true,
    origin: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Payment service is running!');
});

// ---------------------------------

const YouKassa = new YooCheckout({
    shopId: process.env.YOOKASSA_SHOP_ID || '',
    secretKey: process.env.YOOKASSA_SECRET_KEY || ''
});

app.post('/api/payment', async (req: Request, res: Response) => {
    const createPayload: ICreatePayment = {
        amount: {
            value: req.body.value,
            currency: 'RUB'
        },
        payment_method_data: {
            type: 'bank_card'
        },
        capture: true,
        confirmation: {
            type: 'redirect',
            return_url: process.env.FRONTEND_URL || 'https://monke-team-frontend.vercel.app'
        },
        metadata: {
            orderId: req.body.orderId,
            userId: req.body.userId,
        }
    };

    try {
        const payment = await YouKassa.createPayment(
            createPayload,
            // Не делать так в проде
            Date.now().toString()
        );

        database[payment.id] = payment;
        res.json({payment})
    } catch (error) {
        console.error(error);
        res.status(400).json({error: 'error'});
    }
});

app.get('/api/payment/:paymentId', async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.params;

        // Сначала проверяем в нашей базе данных
        if (database[paymentId]) {
            res.json({ payment: database[paymentId] });
            return;
        }

        // Если нет в базе, запрашиваем у ЮKassa
        const payment = await YouKassa.getPayment(paymentId);
        database[payment.id] = payment;

        res.json({ payment });
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(404).json({ error: 'Payment not found' });
    }
});

app.post('/api/payment/notifications', async (req: Request, res: Response) => {
    try {
        const notification = req.body;

        // Логируем уведомление для отладки
        console.log('Received notification:', {
            type: notification.type,
            event: notification.event,
            objectId: notification.object?.id,
            status: notification.object?.status
        });

        // Проверяем тип уведомления
        if (notification.type !== 'notification') {
            console.error('Invalid notification type:', notification.type);
            res.status(400).send();
            return;
        }

        // Обрабатываем событие
        const event = notification.event;
        const paymentObject = notification.object;

        if (!paymentObject || !paymentObject.id) {
            console.error('Invalid payment object in notification');
            res.status(400).send();
            return;
        }

        // Проверяем актуальность статуса платежа через API
        try {
            const actualPayment = await YouKassa.getPayment(paymentObject.id);

            // Сохраняем актуальные данные
            database[actualPayment.id] = {
                ...actualPayment,
                event: event,
                notifiedAt: new Date().toISOString()
            };

            console.log(`Payment ${actualPayment.id} updated:`, {
                status: actualPayment.status,
                paid: actualPayment.paid,
                event: event
            });

            // Обрабатываем разные типы событий
            switch (event) {
                case 'payment.succeeded':
                    console.log(`✅ Payment ${actualPayment.id} succeeded!`);
                    // Здесь можно добавить логику для успешной оплаты
                    // Например, обновить статус заказа в вашей БД
                    break;

                case 'payment.waiting_for_capture':
                    console.log(`⏳ Payment ${actualPayment.id} waiting for capture`);
                    // Логика для платежей, ожидающих подтверждения
                    break;

                case 'payment.canceled':
                    console.log(`❌ Payment ${actualPayment.id} canceled`);
                    // Логика для отмененных платежей
                    break;

                default:
                    console.log(`ℹ️ Event ${event} for payment ${actualPayment.id}`);
            }

        } catch (error) {
            console.error('Error fetching payment from YooKassa:', error);
            // Даже если не удалось проверить через API, сохраняем данные из уведомления
            database[paymentObject.id] = {
                ...paymentObject,
                event: event,
                notifiedAt: new Date().toISOString()
            };
        }

        // Обязательно возвращаем статус 200 для подтверждения получения
        res.status(200).send();

    } catch (error) {
        console.error('Error processing notification:', error);
        // Возвращаем 200 даже при ошибке, чтобы ЮKassa не повторяла отправку
        res.status(200).send();
    }
})

app.listen(PORT, '0.0.0.0' ,() => {
    console.log(`Server running at http://localhost:${PORT}`);
});