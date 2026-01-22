# Winston Logging Implementation Guide

## Installation

```bash
npm install winston
```

## Files Created

1. `config/logger.js` - Main logger configuration
2. `middilwares/requestLogger.js` - HTTP request logging middleware
3. `middilwares/errorLogger.js` - Global error logging middleware
4. `utils/loggerHelper.js` - Helper functions for controller logging

## Integration Steps

### 1. Update Server.js

```javascript
import requestLogger from './middilwares/requestLogger.js';
import errorLogger from './middilwares/errorLogger.js';
import logger from './config/logger.js';

app.use(requestLogger);

app.use(errorLogger);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
});
```

### 2. Update Controllers

Replace `console.log()` and `console.error()` with logger:

```javascript
import { logControllerError, logControllerInfo } from '../utils/loggerHelper.js';

const someController = async (req, res) => {
    try {
        logControllerInfo('ControllerName', 'methodName', 'Operation started', { userId: req.user._id });
        
        const result = await SomeModel.find();
        
        logControllerInfo('ControllerName', 'methodName', 'Operation completed', { count: result.length });
        
        res.json({ success: true, data: result });
    } catch (error) {
        logControllerError('ControllerName', 'methodName', error, { userId: req.user?._id });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
```

### 3. Authentication Logging

```javascript
import { logAuthAttempt } from '../utils/loggerHelper.js';

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            logAuthAttempt('login', email, false, 'User not found');
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            logAuthAttempt('login', email, false, 'Invalid password');
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        logAuthAttempt('login', email, true);
        res.json({ success: true, user });
    } catch (error) {
        logControllerError('AuthController', 'login', error);
        res.status(500).json({ message: 'Server error' });
    }
};
```

### 4. Order/Payment Logging

```javascript
import { logOrderOperation, logPaymentOperation } from '../utils/loggerHelper.js';

const placeOrder = async (req, res) => {
    try {
        const order = await Order.create(orderData);
        
        logOrderOperation('create', order._id, req.user._id, {
            amount: order.finalAmount,
            items: order.orderItems.length
        });
        
        res.json({ success: true, order });
    } catch (error) {
        logControllerError('OrderController', 'placeOrder', error);
        res.status(500).json({ message: 'Failed to place order' });
    }
};
```

## Environment Variables

Add to `.env`:

```env
NODE_ENV=development
LOG_LEVEL=info
```

For production:
```env
NODE_ENV=production
LOG_LEVEL=warn
```

## Log Levels

- `error` - Critical errors
- `warn` - Warning messages
- `info` - General information
- `http` - HTTP requests
- `debug` - Debug information

## Log Files

Logs are stored in `/logs` directory:
- `error.log` - Error logs only
- `combined.log` - All logs
- `http.log` - HTTP request logs

Files rotate at 5MB with 5 backups.

## Quick Migration

Replace all instances:
- `console.log()` → `logger.info()`
- `console.error()` → `logger.error()`
- `console.warn()` → `logger.warn()`

Or use helper functions for structured logging.
