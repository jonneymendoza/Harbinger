import { Router } from 'express';
import initRoute from './init.route';
import logoutRoute from './logout.route';
import guestRoute from './guest.route';
import { googleCallbackHandler, appleCallbackHandler, facebookCallbackHandler } from './callback.route';

const router = Router();

// Register specific routes BEFORE the catch-all '/' route so they are not consumed by it
router.use('/guest', guestRoute);
router.use('/logout', logoutRoute);

// Register individual OAuth callback routes at the correct paths
router.get('/google/callback', googleCallbackHandler);
router.get('/apple/callback', appleCallbackHandler);
router.get('/facebook/callback', facebookCallbackHandler);

// All other auth routes go to init (for OAuth initiation)
router.use('/', initRoute);

export { default as logoutRoute } from './logout.route';
export default router;
