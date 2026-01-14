
import Order from '../models/orderSchema.js';
import Product from '../models/productSchema.js';

export function calculateItemEffectivePrices(orderItems, totalDiscount, totalTax = 0, totalShipping = 0) {

    const itemsTotal = orderItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);


    if (itemsTotal === 0) {
        return orderItems.map(item => ({
            ...item,
            itemTotal: 0,
            discountShare: 0,
            taxShare: 0,
            shippingShare: 0,
            effectivePrice: 0
        }));
    }


    return orderItems.map(item => {
        const itemTotal = item.price * item.quantity;
        const itemRatio = itemTotal / itemsTotal;
        

        const discountShare = Math.round(totalDiscount * itemRatio);
        const taxShare = Math.round(totalTax * itemRatio);
        const shippingShare = Math.round(totalShipping * itemRatio);
        
        
        const effectivePrice = itemTotal + taxShare + shippingShare - discountShare;

        return {
            ...item,
            itemTotal,
            discountShare,
            taxShare,
            shippingShare,
            effectivePrice,
            refundAmount: 0,
            isRefunded: false
        };
    });
}


export function calculateItemRefund(item, order) {
    
    if (!item) {
        return { refundAmount: 0, error: 'Item not found' };
    }

    
    if (item.isRefunded || item.refundAmount > 0) {
        return { refundAmount: 0, error: 'Item already refunded' };
    }

    
    if (!['Online', 'Wallet'].includes(order.paymentMethod) || order.paymentStatus !== 'Completed') {
        return { refundAmount: 0, error: 'Order not paid, no refund needed' };
    }


    let refundAmount = 0;
    
    if (item.effectivePrice !== undefined && item.effectivePrice > 0) {
        
        refundAmount = item.effectivePrice;
    } else {
        
        const itemTotal = item.price * item.quantity;
        
        
        const activeItems = order.orderItems.filter(it => it.status === 'Active');
        const activeTotal = activeItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
        
        if (activeTotal > 0) {
            const itemRatio = itemTotal / activeTotal;
            const discountShare = Math.round((order.discount || 0) * itemRatio);
            refundAmount = itemTotal - discountShare;
        } else {
            refundAmount = itemTotal;
        }
    }

    
    refundAmount = Math.max(0, refundAmount);

    
    const currentTotalRefunded = order.totalRefunded || 0;
    const orderFinalAmount = parseFloat(order.finalAmount);
    
    if (currentTotalRefunded + refundAmount > orderFinalAmount) {
        
        refundAmount = Math.max(0, orderFinalAmount - currentTotalRefunded);
    }

    return { refundAmount, error: null };
}



export async function cancelItem(orderId, itemId, userId, reason = 'Cancelled by user') {
    try {

        const order = await Order.findOne({
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        }).populate('orderItems.product');

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        
        if (!['Pending', 'Processing'].includes(order.status)) {
            return { success: false, error: 'Cannot cancel items from this order' };
        }

        
        const itemIndex = order.orderItems.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return { success: false, error: 'Item not found in order' };
        }

        const item = order.orderItems[itemIndex];

        
        if (item.status === 'Cancelled') {
            return { success: false, error: 'Item already cancelled' };
        }


        const { refundAmount, error } = calculateItemRefund(item, order);
        
        if (error && refundAmount === 0) {
            return { success: false, error };
        }

        
        item.status = 'Cancelled';
        item.cancelReason = reason;
        item.refundAmount = refundAmount;
        item.isRefunded = true;

        order.totalRefunded = (order.totalRefunded || 0) + refundAmount;

        
        const activeItems = order.orderItems.filter(it => it.status === 'Active');
        if (activeItems.length === 0) {
            order.status = 'Cancelled';
            order.cancelReason = 'All items cancelled';
            order.cancelledOn = new Date();
        }

        
        await order.save();


        const product = await Product.findById(item.product._id || item.product);
        if (product) {
            const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
            if (variantIndex !== -1) {
                product.variants[variantIndex].quantity += item.quantity;
                await product.save();
            }
        }

        return {
            success: true,
            refundAmount,
            message: 'Item cancelled successfully',
            order
        };

    } catch (error) {
        console.error('Error in cancelItem:', error);
        return { success: false, error: error.message };
    }
}


export async function returnItem(orderId, itemId, userId, reason = 'Returned by user') {
    try {
        
        const order = await Order.findOne({
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        }).populate('orderItems.product');

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        
        if (order.status !== 'Delivered') {
            return { success: false, error: 'Only delivered orders can be returned' };
        }

        
        const deliveredDate = new Date(order.deliveredOn);
        const currentDate = new Date();
        const daysDifference = Math.floor((currentDate - deliveredDate) / (1000 * 60 * 60 * 24));

        if (daysDifference > 7) {
            return { success: false, error: 'Return window expired (7 days)' };
        }

        
        const itemIndex = order.orderItems.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return { success: false, error: 'Item not found in order' };
        }

        const item = order.orderItems[itemIndex];

        
        if (item.status !== 'Active') {
            return { success: false, error: 'Item cannot be returned' };
        }

        
        if (item.returnStatus !== 'None') {
            return { success: false, error: 'Return already requested for this item' };
        }

        
        const { refundAmount, error } = calculateItemRefund(item, order);
        
        if (error && refundAmount === 0) {
            return { success: false, error };
        }

        
        item.status = 'Returned';
        item.returnReason = reason;
        item.returnStatus = 'Completed';
        item.refundAmount = refundAmount;
        item.isRefunded = true;

        
        order.totalRefunded = (order.totalRefunded || 0) + refundAmount;

        
        const activeItems = order.orderItems.filter(it => it.status === 'Active');
        if (activeItems.length === 0) {
            order.status = 'Returned';
            order.returnStatus = 'Completed';
        }

        
        await order.save();

        
        const product = await Product.findById(item.product._id || item.product);
        if (product) {
            const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
            if (variantIndex !== -1) {
                product.variants[variantIndex].quantity += item.quantity;
                await product.save();
            }
        }

        return {
            success: true,
            refundAmount,
            message: 'Item return processed successfully',
            order
        };

    } catch (error) {
        console.error('Error in returnItem:', error);
        return { success: false, error: error.message };
    }
}


export async function cancelOrder(orderId, userId, reason = 'Cancelled by user') {
    try {
        const order = await Order.findOne({
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        }).populate('orderItems.product');

        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return { success: false, error: 'Cannot cancel this order' };
        }

        let totalRefund = 0;


        for (const item of order.orderItems) {
            if (item.status === 'Active' && !item.isRefunded) {
                const { refundAmount } = calculateItemRefund(item, order);
                
                item.status = 'Cancelled';
                item.cancelReason = reason;
                item.refundAmount = refundAmount;
                item.isRefunded = true;
                
                totalRefund += refundAmount;

                
                const product = await Product.findById(item.product._id || item.product);
                if (product) {
                    const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
                    if (variantIndex !== -1) {
                        product.variants[variantIndex].quantity += item.quantity;
                        await product.save();
                    }
                }
            }
        }

        
        order.status = 'Cancelled';
        order.cancelReason = reason;
        order.cancelledOn = new Date();
        order.totalRefunded = (order.totalRefunded || 0) + totalRefund;

        await order.save();

        return {
            success: true,
            refundAmount: totalRefund,
            message: 'Order cancelled successfully',
            order
        };

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        return { success: false, error: error.message };
    }
}
