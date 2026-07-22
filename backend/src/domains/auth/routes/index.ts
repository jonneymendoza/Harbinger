import { Router } from 'express';
import initRoute from './init.route';
import callbackRoute from './callback.route';
import logoutRoute from './logout.route';

const router = Router();

router.use('/', initRoute);
router.use('/', callbackRoute);
router.use('/logout', logoutRoute);

export { initRoute, callbackRoute, logoutRoute };
export default router;
