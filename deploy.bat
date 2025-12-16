@echo off
echo Adding remote origin...
git remote add origin https://github.com/Calcifer-02/payment.git

echo Renaming branch to main...
git branch -M main

echo Pushing to origin...
git push -u origin main

echo Done.
pause

