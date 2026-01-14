/**
 * Success Messages Constants
 * Centralized success messages for consistency across the application
 */

const SUCCESS_MESSAGES = {
    // Authentication
    AUTH: {
        LOGIN_SUCCESS: 'Login successful',
        LOGOUT_SUCCESS: 'Logout successful',
        REGISTER_SUCCESS: 'Registration successful',
        PASSWORD_RESET: 'Password reset successful',
        PASSWORD_CHANGED: 'Password changed successfully',
        EMAIL_VERIFIED: 'Email verified successfully'
    },

    // User
    USER: {
        PROFILE_UPDATED: 'Profile updated successfully',
        ACCOUNT_CREATED: 'Account created successfully',
        ACCOUNT_DELETED: 'Account deleted successfully',
        PREFERENCES_SAVED: 'Preferences saved successfully'
    },

    // Order
    ORDER: {
        CREATED: 'Order placed successfully',
        UPDATED: 'Order updated successfully',
        CANCELLED: 'Order cancelled successfully',
        STATUS_UPDATED: 'Order status updated successfully',
        INVOICE_GENERATED: 'Invoice generated successfully'
    },

    // Product
    PRODUCT: {
        ADDED: 'Product added successfully',
        UPDATED: 'Product updated successfully',
        DELETED: 'Product deleted successfully',
        STOCK_UPDATED: 'Stock updated successfully'
    },

    // Cart
    CART: {
        ITEM_ADDED: 'Item added to cart',
        ITEM_REMOVED: 'Item removed from cart',
        UPDATED: 'Cart updated successfully',
        CLEARED: 'Cart cleared successfully'
    },

    // Wishlist
    WISHLIST: {
        ITEM_ADDED: 'Item added to wishlist',
        ITEM_REMOVED: 'Item removed from wishlist'
    },

    // Wishlist Errors
    WISHLIST_ERROR: {
        NOT_FOUND: 'Wishlist not found',
        ALREADY_EXISTS: 'Product is already in your wishlist',
        ADD_FAILED: 'Failed to add item to wishlist',
        REMOVE_FAILED: 'Failed to remove item from wishlist'
    },

    
    ADDRESS: {
        ADDED: 'Address added successfully',
        UPDATED: 'Address updated successfully',
        DELETED: 'Address deleted successfully',
        SET_DEFAULT: 'Default address updated'
    },

    
    PAYMENT: {
        SUCCESS: 'Payment completed successfully',
        REFUND_INITIATED: 'Refund initiated successfully',
        REFUND_COMPLETED: 'Refund completed successfully'
    },

    
    RETURN: {
        REQUEST_SUBMITTED: 'Return request submitted successfully',
        APPROVED: 'Return request approved',
        REJECTED: 'Return request rejected',
        COMPLETED: 'Return completed successfully'
    },

    
    COUPON: {
        APPLIED: 'Coupon applied successfully',
        REMOVED: 'Coupon removed',
        CREATED: 'Coupon created successfully',
        UPDATED: 'Coupon updated successfully',
        DELETED: 'Coupon deleted successfully',
        STATUS_UPDATED: 'Coupon status updated successfully'
    },

    // Category
    CATEGORY: {
        ADDED: 'Category added successfully',
        UPDATED: 'Category updated successfully',
        DELETED: 'Category deleted successfully'
    },

    // Brand
    BRAND: {
        ADDED: 'Brand added successfully',
        UPDATED: 'Brand updated successfully',
        DELETED: 'Brand deleted successfully',
        BLOCKED: 'Brand blocked successfully',
        UNBLOCKED: 'Brand unblocked successfully'
    },

    // Offer
    OFFER: {
        APPLIED: 'Offer applied successfully',
        REMOVED: 'Offer removed successfully',
        UPDATED: 'Offer updated successfully'
    },

    // Referral
    REFERRAL: {
        REWARD_CREDITED: 'Reward credited successfully',
        REWARD_REVOKED: 'Reward revoked successfully'
    },

    // Settings
    SETTINGS: {
        UPDATED: 'Settings updated successfully'
    },

    
    REVIEW: {
        SUBMITTED: 'Review submitted successfully',
        UPDATED: 'Review updated successfully',
        DELETED: 'Review deleted successfully'
    },

    
    GENERAL: {
        OPERATION_SUCCESS: 'Operation completed successfully',
        SAVED: 'Changes saved successfully',
        DELETED: 'Deleted successfully',
        UPDATED: 'Updated successfully',
        CREATED: 'Created successfully'
    }
};


Object.freeze(SUCCESS_MESSAGES);


export const getSuccessMessage = (category, key) => {
    return SUCCESS_MESSAGES[category]?.[key] || SUCCESS_MESSAGES.GENERAL.OPERATION_SUCCESS;
};

export default SUCCESS_MESSAGES;
