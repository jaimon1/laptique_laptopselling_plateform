import Order from '../../models/orderSchema.js';
import PDFDocument from 'pdfkit';
import * as refundService from '../../services/refundService.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

async function creditWallet(userId, amount, description, orderId) {
    if (!amount || amount <= 0) return;


        const { credit } = await import('../../services/walletService.js');
        
        await credit(userId, amount, {
            source: 'ORDER_CANCEL_REFUND',
            referenceModel: 'Order',
            referenceId: orderId,
            notes: description
        });
}


const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';


        let searchQuery = { 
            userId
        };
        
        if (search) {
            searchQuery.$and = searchQuery.$and || [];
            searchQuery.$and.push({
                $or: [
                    { orderId: { $regex: search, $options: 'i' } },
                    { status: { $regex: search, $options: 'i' } }
                ]
            });
        }


        const orders = await Order.find(searchQuery)
            .populate('orderItems.product')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('orders', {
            user: req.session.user || req.user,
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            title: 'My Orders'
        });

    }catch (_error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        const order = await Order.findOne({ 
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        }).populate('orderItems.product');

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).render('pageNotFound');
        }

        res.render('orderDetails', {
            user: req.session.user || req.user,
            order,
            title: 'Order Details'
        });
    } catch (_error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        
        const result = await refundService.cancelOrder(orderId, userId, reason || 'Cancelled by user');

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: result.error || ERROR_MESSAGES.ORDER.CANCEL_FAILED
            });
        }

        
        if (result.refundAmount > 0) {
            await creditWallet(userId, result.refundAmount, `Refund for cancelled order ${result.order.orderId}`, result.order._id);
        }

        res.json({ 
            success: true, 
            message: result.message,
            refunded: result.refundAmount > 0,
            refundAmount: result.refundAmount
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.ORDER.CANCEL_FAILED
        });
    }
};


const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }


        const result = await refundService.cancelItem(orderId, itemId, userId, reason || 'Cancelled by user');

        if (!result.success) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: result.error || ERROR_MESSAGES.ORDER.CANCEL_FAILED
            });
        }


        if (result.refundAmount > 0) {
            await creditWallet(userId, result.refundAmount, `Refund for cancelled item in order ${result.order.orderId}`, result.order._id);
        }

        res.json({ 
            success: true, 
            message: result.message,
            refunded: result.refundAmount > 0,
            refundAmount: result.refundAmount
        });

    } catch (_error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.ORDER.CANCEL_FAILED
        });
    }
};

const requestOrderReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        if (!reason || reason.trim() === '') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD
            });
        }

        const order = await Order.findOne({ 
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        });

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }

        if (order.status !== 'Delivered') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.ONLY_DELIVERED
            });
        }


        const deliveredDate = new Date(order.deliveredOn);
        const currentDate = new Date();
        const daysDifference = Math.floor((currentDate - deliveredDate) / (1000 * 60 * 60 * 24));

        if (daysDifference > 7) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.WINDOW_EXPIRED
            });
        }


        order.status = 'Return Request';
        order.returnStatus = 'Requested';
        order.returnReason = reason.trim();
        order.returnRequestedOn = new Date();


        order.orderItems.forEach(item => {
            if (item.status === 'Active') {
                item.returnStatus = 'Requested';
                item.returnReason = reason.trim();
            }
        });


        order.statusHistory.push({
            status: 'Return Request',
            updatedBy: userId,
            note: `Return requested: ${reason.trim()}`
        });

        await order.save();

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.RETURN.REQUEST_SUBMITTED
        });

    } catch (error) {
        console.error('Error requesting order return:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.RETURN.REQUEST_FAILED
        });
    }
};


const requestItemReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        if (!reason || reason.trim() === '') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD
            });
        }

        const order = await Order.findOne({ 
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        });

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }

        if (order.status !== 'Delivered') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.ONLY_DELIVERED
            });
        }

        const deliveredDate = new Date(order.deliveredOn);
        const currentDate = new Date();
        const daysDifference = Math.floor((currentDate - deliveredDate) / (1000 * 60 * 60 * 24));

        if (daysDifference > 7) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.WINDOW_EXPIRED
            });
        }

        const itemIndex = order.orderItems.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.ITEM_NOT_FOUND
            });
        }

        const item = order.orderItems[itemIndex];
        if (item.status !== 'Active') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.CANNOT_RETURN
            });
        }

        if (item.returnStatus !== 'None') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.RETURN.ALREADY_REQUESTED
            });
        }


        item.returnStatus = 'Requested';
        item.returnReason = reason.trim();

        const activeItems = order.orderItems.filter(item => item.status === 'Active');
        const returnRequestedItems = activeItems.filter(item => item.returnStatus === 'Requested');

        if (returnRequestedItems.length === activeItems.length) {
            order.status = 'Return Request';
            order.returnStatus = 'Requested';
            order.returnReason = 'Items return requested';
            order.returnRequestedOn = new Date();
        }

        await order.save();

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.RETURN.REQUEST_SUBMITTED
        });

    } catch (_error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.RETURN.REQUEST_FAILED
        });
    }
};


const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const order = await Order.findOne({ 
            $or: [
                { _id: orderId, userId },
                { orderId: orderId, userId }
            ]
        }).populate('orderItems.product').populate('userId');

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }

     
        let activeItemsSubtotal = 0;  
        let cancelledReturnedSubtotal = 0; 
        
        order.orderItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
  
         
            if (item.status === 'Cancelled' || item.status === 'Returned' || item.returnStatus === 'Approved') {
                cancelledReturnedSubtotal += itemTotal;
            } else {
                activeItemsSubtotal += itemTotal;
            }
        });

        
        const originalTotal = order.totalPrice;
        const hasCancelledOrReturned = cancelledReturnedSubtotal > 0;
        
       
        const discountRatio = originalTotal > 0 ? order.discount / originalTotal : 0;
        const currentDiscount = Math.round(activeItemsSubtotal * discountRatio);
        

        const taxRatio = originalTotal > 0 ? (order.tax || 0) / originalTotal : 0;
        const currentTax = Math.round(activeItemsSubtotal * taxRatio);
        

        let currentCouponDiscount = 0;
        if (order.couponApplied && order.couponDetails) {
            const couponRatio = originalTotal > 0 ? order.couponDetails.discount / originalTotal : 0;
            currentCouponDiscount = Math.round(activeItemsSubtotal * couponRatio);
        }
        

        const currentFinalAmount = activeItemsSubtotal - currentDiscount - currentCouponDiscount + currentTax + (order.shippingFee || 0);


        const doc = new PDFDocument({ margin: 50 });
        

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        

        doc.pipe(res);

      
        doc.fontSize(20).text('LapTique', 50, 50);
        doc.fontSize(10).text('Premium Laptop Store', 50, 75);
        doc.text('Email: laptiqueLaptop@gmail.com', 50, 90);
        doc.text('Phone: +91 9061587964', 50, 105);

  
        doc.fontSize(16).text('INVOICE', 400, 50);
        doc.fontSize(10).text(`Invoice #: ${order.orderId}`, 400, 75);
        doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 400, 90);
        doc.text(`Status: ${order.status}`, 400, 105);


        doc.fontSize(12).text('Bill To:', 50, 150);
        doc.fontSize(10).text(`${order.address.name}`, 50, 170);
        doc.text(`${order.address.landmark}`, 50, 185);
        doc.text(`${order.address.city}, ${order.address.state}`, 50, 200);
        doc.text(`Phone: ${order.address.phone}`, 50, 215);


        let yPosition = 260;
        doc.fontSize(12).text('Order Items:', 50, yPosition);
        yPosition += 20;

   
        doc.fontSize(10);
        doc.text('Product', 50, yPosition);
        doc.text('Variant', 200, yPosition);
        doc.text('Qty', 300, yPosition);
        doc.text('Price', 350, yPosition);
        doc.text('Total', 450, yPosition);
        doc.text('Status', 500, yPosition);
        

        yPosition += 15;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;


        order.orderItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            

            if (item.status === 'Cancelled') {
                doc.fillColor('#999999'); 
            } else {
                doc.fillColor('#000000'); 
            }
            
            doc.text(item.product.productName.substring(0, 25), 50, yPosition);
            doc.text(item.variant.storage || 'Default', 200, yPosition);
            doc.text(item.quantity.toString(), 300, yPosition);
            doc.text(`₹${item.price.toLocaleString()}`, 350, yPosition);
            doc.text(`₹${itemTotal.toLocaleString()}`, 450, yPosition);
            doc.text(item.status || 'Active', 500, yPosition);
            
            yPosition += 20;
            
      
            doc.fillColor('#000000');
        });


        if (hasCancelledOrReturned) {
            yPosition += 10;
            doc.fontSize(9).fillColor('#dc3545');
            doc.text(`Cancelled/Returned Items Total: ₹${cancelledReturnedSubtotal.toLocaleString()}`, 350, yPosition);
            doc.fillColor('#000000');
            yPosition += 15;
        }


        yPosition += 10;
        doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 15;


        if (hasCancelledOrReturned) {
            doc.fontSize(9).fillColor('#666666');
            doc.text('Original Order Total:', 350, yPosition);
            doc.text(`₹${originalTotal.toLocaleString()}`, 450, yPosition);
            yPosition += 15;
            doc.fillColor('#000000');
            doc.fontSize(10);
            doc.text('Current Order Amount:', 350, yPosition);
            yPosition += 15;
        }

        doc.text(`Subtotal ${hasCancelledOrReturned ? '(Delivered Items)' : ''}:`, 350, yPosition);
        doc.text(`₹${activeItemsSubtotal.toLocaleString()}`, 450, yPosition);
        yPosition += 15;

        if (currentDiscount > 0) {
            doc.text(`Discount ${hasCancelledOrReturned ? '(Proportional)' : ''}:`, 350, yPosition);
            doc.text(`-₹${currentDiscount.toLocaleString()}`, 450, yPosition);
            yPosition += 15;
        }

        if (order.couponApplied && order.couponDetails) {
            doc.text(`Coupon (${order.couponDetails.code}) ${hasCancelledOrReturned ? '(Proportional)' : ''}:`, 350, yPosition);
            doc.text(`-₹${(hasCancelledOrReturned ? currentCouponDiscount : order.couponDetails.discount).toLocaleString()}`, 450, yPosition);
            yPosition += 15;
        }

        doc.text(`Tax (GST) ${hasCancelledOrReturned ? '(Delivered Items Only)' : ''}:`, 350, yPosition);
        doc.text(`₹${(hasCancelledOrReturned ? currentTax : order.tax).toLocaleString()}`, 450, yPosition);
        yPosition += 15;

        if (order.shippingFee > 0) {
            doc.text('Shipping:', 350, yPosition);
            doc.text(`₹${order.shippingFee.toLocaleString()}`, 450, yPosition);
            yPosition += 15;
        }

   
        if (order.totalRefunded && order.totalRefunded > 0) {
            doc.fillColor('#28a745');
            doc.text('Refunded:', 350, yPosition);
            doc.text(`₹${order.totalRefunded.toLocaleString()}`, 450, yPosition);
            doc.fillColor('#000000');
            yPosition += 15;
        }

        
        yPosition += 5;
        doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;
        
        doc.fontSize(12);
        doc.text(`${hasCancelledOrReturned ? 'Current' : ''} Total Amount:`, 350, yPosition);
        doc.text(`₹${(hasCancelledOrReturned ? currentFinalAmount : parseInt(order.finalAmount)).toLocaleString()}`, 450, yPosition);

   
        yPosition += 30;
        doc.fontSize(10);
        doc.text(`Payment Method: ${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}`, 50, yPosition);
        doc.text(`Payment Status: ${order.paymentStatus}`, 50, yPosition + 15);

        
        if (hasCancelledOrReturned) {
            yPosition += 40;
            doc.fontSize(9).fillColor('#666666');
            doc.text('Note: Cancelled/Returned items are shown in gray.', 50, yPosition);
            doc.text('Tax is calculated only for delivered items. Cancelled/Returned items do not include tax.', 50, yPosition + 12);
            doc.text('Refunds for cancelled/returned items have been processed to your original payment method.', 50, yPosition + 24);
            doc.fillColor('#000000');
        }

        
        yPosition += 40;
        doc.fontSize(10);
        doc.text('Thank you for shopping with LapTique!', 50, yPosition);
        doc.text('For any queries, contact us at support@laptique.com', 50, yPosition + 15);

        
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.ORDER.INVOICE_FAILED
        });
    }
};

export {
    loadOrders,
    getOrderDetails,
    cancelOrder,
    cancelOrderItem,
    requestOrderReturn,
    requestItemReturn,
    downloadInvoice
};