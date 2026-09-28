import router from 'express';
import { signup, login, doctorLogin, doctorSignup, logout } from '../controllers/authController.js';

const authRouter = router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/doctor/signup', doctorSignup);
authRouter.post('/doctor/login', doctorLogin);
authRouter.post('/logout', logout);

export default authRouter;