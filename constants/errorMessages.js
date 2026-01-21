

const ERROR_MESSAGES = {

    AUTH: {
        LOGIN_REQUIRED: 'Please login to continue',
        UNAUTHORIZED: 'You are not authorized to perform this action',
        INVALID_CREDENTIALS: 'Invalid email or password',
        SESSION_EXPIRED: 'Your session has expired. Please login again',
        ACCOUNT_BLOCKED: 'Your account has been blocked. Please contact support',
        ADMIN_ACCESS_REQUIRED: 'Admin access required',
        TOKEN_INVALID: 'Invalid or expired token',
        TOKEN_MISSING: 'Authentication token is missing',
        LOGIN_FAILED: 'Login failed. Please try again'
    },

    USER: {
        NOT_FOUND: 'User not found',
        ALREADY_EXISTS: 'User with this email already exists',
        INVALID_EMAIL: 'Please provide a valid email address',
        WEAK_PASSWORD: 'Password must be at least 8 characters long',
        PASSWORD_MISMATCH: 'Passwords do not match',
        UPDATE_FAILED: 'Failed to update user information',
        DELETE_FAILED: 'Failed to delete user'
    },


    ORDER: {
        NOT_FOUND: 'Order not found',
        CREATE_FAILED: 'Failed to create order',
        UPDATE_FAILED: 'Failed to update order',
        CANCEL_FAILED: 'Failed to cancel order',
        ALREADY_CANCELLED: 'Order has already been cancelled',
        CANNOT_CANCEL: 'This order cannot be cancelled',
        INVALID_STATUS: 'Invalid order status',
        EMPTY_CART: 'Your cart is empty',
        INSUFFICIENT_STOCK: 'Insufficient stock for one or more items',
        PAYMENT_FAILED: 'Payment processing failed',
        PAYMENT_REQUIRED: 'Payment is required to complete this order',
        ITEM_NOT_FOUND: 'Item not found in order',
        INVOICE_FAILED: 'Failed to generate invoice',
        ALREADY_DELIVERED: 'Cannot change status of delivered orders',
        INVALID_STATUS_CHANGE: 'Cannot move order backwards in the delivery process'
    },


    PRODUCT: {
        NOT_FOUND: 'Product not found',
        OUT_OF_STOCK: 'Product is out of stock',
        INVALID_QUANTITY: 'Invalid quantity specified',
        CREATE_FAILED: 'Failed to create product',
        UPDATE_FAILED: 'Failed to update product',
        DELETE_FAILED: 'Failed to delete product',
        ALREADY_EXISTS: 'Product with this name already exists',
        INSUFFICIENT_STOCK: 'Insufficient stock available'
    },


    CART: {
        EMPTY: 'Your cart is empty',
        ITEM_NOT_FOUND: 'Item not found in cart',
        ADD_FAILED: 'Failed to add item to cart',
        UPDATE_FAILED: 'Failed to update cart',
        REMOVE_FAILED: 'Failed to remove item from cart',
        INVALID_QUANTITY: 'Please specify a valid quantity',
        MAX_QUANTITY_EXCEEDED: 'Maximum quantity limit exceeded'
    },


    ADDRESS: {
        NOT_FOUND: 'Address not found',
        REQUIRED: 'Delivery address is required',
        INVALID: 'Please provide a valid address',
        CREATE_FAILED: 'Failed to add address',
        UPDATE_FAILED: 'Failed to update address',
        DELETE_FAILED: 'Failed to delete address'
    },


    PAYMENT: {
        FAILED: 'Payment processing failed',
        INVALID_METHOD: 'Invalid payment method',
        AMOUNT_MISMATCH: 'Payment amount does not match order total',
        TRANSACTION_FAILED: 'Transaction failed. Please try again',
        REFUND_FAILED: 'Failed to process refund',
        INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
        INCOMPLETE: 'Payment is not completed'
    },

  
    RETURN: {
        NOT_ALLOWED: 'Returns are not allowed for this order',
        WINDOW_EXPIRED: 'Return window has expired. Returns are only allowed within 7 days of delivery',
        ALREADY_REQUESTED: 'Return request already exists for this item',
        REASON_REQUIRED: 'Return reason is required',
        REQUEST_FAILED: 'Failed to submit return request',
        ONLY_DELIVERED: 'Only delivered orders can be returned',
        APPROVAL_FAILED: 'Failed to process return approval',
        REJECTION_FAILED: 'Failed to process return rejection',
        CANNOT_RETURN: 'This item cannot be returned',
        PROCESS_FAILED: 'Failed to process return request'
    },


    COUPON: {
        INVALID: 'Invalid coupon code',
        EXPIRED: 'This coupon has expired',
        NOT_APPLICABLE: 'This coupon is not applicable to your order',
        ALREADY_USED: 'You have already used this coupon',
        MINIMUM_NOT_MET: 'Minimum order amount not met for this coupon',
        MAX_USAGE_REACHED: 'This coupon has reached its maximum usage limit',
        NOT_FOUND: 'Coupon not found',
        ALREADY_EXISTS: 'Coupon code already exists',
        CANNOT_DELETE: 'Cannot delete coupon that has been used by customers'
    },

    CATEGORY: {
        NOT_FOUND: 'Category not found',
        ALREADY_EXISTS: 'Category already exists',
        CREATE_FAILED: 'Failed to create category',
        UPDATE_FAILED: 'Failed to update category',
        DELETE_FAILED: 'Failed to delete category'
    },

   
    BRAND: {
        NOT_FOUND: 'Brand not found',
        ALREADY_EXISTS: 'Brand already exists',
        CREATE_FAILED: 'Failed to create brand',
        UPDATE_FAILED: 'Failed to update brand',
        DELETE_FAILED: 'Failed to delete brand'
    },


    WALLET: {
        INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
        TRANSACTION_FAILED: 'Wallet transaction failed',
        NOT_FOUND: 'Wallet not found'
    },


    REFERRAL: {
        NOT_FOUND: 'Referral not found',
        ALREADY_REWARDED: 'Reward already given',
        NO_REWARD_TO_REVOKE: 'No reward to revoke',
        INVALID_CODE: 'Invalid referral code'
    },

   
    WISHLIST: {
        NOT_FOUND: 'Wishlist not found',
        ALREADY_EXISTS: 'Product is already in your wishlist',
        ADD_FAILED: 'Failed to add item to wishlist',
        REMOVE_FAILED: 'Failed to remove item from wishlist'
    },


    VALIDATION: {
        REQUIRED_FIELDS: 'Please fill in all required fields',
        REQUIRED_FIELD: 'This field is required',
        INVALID_INPUT: 'Invalid input provided',
        INVALID_FORMAT: 'Invalid data format',
        INVALID_ID: 'Invalid ID provided',
        INVALID_DATE: 'Invalid date format',
        INVALID_PHONE: 'Please provide a valid phone number',
        INVALID_PINCODE: 'Please provide a valid pincode'
    },


    FILE: {
        UPLOAD_FAILED: 'File upload failed',
        INVALID_TYPE: 'Invalid file type. Please upload a valid image',
        TOO_LARGE: 'File size is too large. Maximum size is 5MB',
        REQUIRED: 'Please upload at least one image'
    },


    SERVER: {
        INTERNAL_ERROR: 'Internal server error. Please try again later',
        DATABASE_ERROR: 'Database operation failed',
        SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
        NETWORK_ERROR: 'Network error. Please check your connection',
        TIMEOUT: 'Request timeout. Please try again'
    },

    GENERAL: {
        SOMETHING_WENT_WRONG: 'Something went wrong. Please try again',
        OPERATION_FAILED: 'Operation failed. Please try again',
        NOT_FOUND: 'Requested resource not found',
        ACCESS_DENIED: 'Access denied',
        INVALID_REQUEST: 'Invalid request',
        MAINTENANCE: 'System is under maintenance. Please try again later'
    }
};


Object.freeze(ERROR_MESSAGES);


export const getErrorMessage = (category, key) => {
    return ERROR_MESSAGES[category]?.[key] || ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG;
};

export default ERROR_MESSAGES;
