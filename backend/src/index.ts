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

app.post('/api/payment/notifications', async (req: Request, res: Response) => {
    console.log(req.body)
    database[req.body.id] = req.body;
    res.json({status: "OK"})
})

app.listen(PORT, '0.0.0.0' ,() => {
    console.log(`Server running at http://localhost:${PORT}`);
});