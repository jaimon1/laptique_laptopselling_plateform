import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './Router/userRoutes/userRoute.js';
import adminRouter from './Router/adminRoutes/adminRoute.js';
import session from 'express-session';
import passport from './config/passport.js';
import { dbConnect } from './config/db.js';
import MongoStore from 'connect-mongo';
import nocache from 'nocache';
import logger from './config/logger.js';
import requestLogger from './middilwares/requestLogger.js';
import errorLogger from './middilwares/errorLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.set('etag', false);

dbConnect();

app.use(requestLogger);

app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const userSessionStore = MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URL,
    collectionName: 'userSessions',
    ttl: 72 * 60 * 60,
    touchAfter: 24 * 3600 
});

const adminSessionStore = MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URL,
    collectionName: 'adminSessions',
    ttl: 24 * 60 * 60,
    touchAfter: 24 * 3600 
});


const userSession = session({
    name: 'user.sid', 
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true, // MUST be true for OAuth to work
    store: userSessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        sameSite: 'lax', // 'lax' works for OAuth redirects from Google
        maxAge: 72 * 60 * 60 * 1000,
        path: '/'
    },
    rolling: true,
    unset: 'destroy',
    proxy: process.env.NODE_ENV === 'production'
});


const adminSession = session({
    name: 'admin.sid',
    secret: process.env.SESSION_ADMIN_SECRET || process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: adminSessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true, 
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/admin', 
        domain: undefined 
    },
    rolling: true,
    unset: 'destroy' 
});


app.use(express.static('public', {
    maxAge: 0, 
    etag: false
}));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/adminCss', express.static(path.join(__dirname, 'public/adminCss'), {
    maxAge: 0,
    etag: false,
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/css');
    }
}));
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/users'), path.join(__dirname, 'views/admin')]);


app.use('/admin', adminSession, adminRouter);

app.use('/', userSession, passport.initialize(), passport.session(), router);

app.use(errorLogger);

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    logger.info(`Server started successfully on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});