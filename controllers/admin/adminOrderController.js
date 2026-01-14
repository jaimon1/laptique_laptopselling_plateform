import Order from '../../models/orderSchema.js';
import Product from '../../models/productSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const loadOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const sortBy = req.query.sortBy || 'createdOn';
        const sortOrder = req.query.sortOrder || 'desc';

        
        let searchQuery = {
            $and: [
                
                {
                    $or: [
                        { paymentMethod: 'COD' }, 
                        { paymentStatus: 'Completed' }, 
                        { paymentStatus: 'Pending', status: { $nin: ['Failed', 'Cancelled'] } } 
                    ]
                },
                
                { status: { $ne: 'Failed' } }
            ]
        };

        if (search) {
            searchQuery.$and = searchQuery.$and || [];
            searchQuery.$and.push({
                $or: [
                    { orderId: { $regex: search, $options: 'i' } },
                    { 'address.name': { $regex: search, $options: 'i' } },
                    { 'address.phone': { $regex: search, $options: 'i' } }
                ]
            });
        }

        if (status) {
            searchQuery.$and = searchQuery.$and || [];
            searchQuery.$and.push({ status: status });
        }

        
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        
        const orders = await Order.find(searchQuery)
            .populate('userId', 'name email')
            .populate('orderItems.product', 'productName ProductImages')
            .sort(sortObj)
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalOrders / limit);

        
        const orderStats = await Order.aggregate([
            {
                $match: {
                    $and: [
                        {
                            $or: [
                                { paymentMethod: 'COD' },
                                { paymentStatus: 'Completed' },
                                { paymentStatus: 'Pending', status: { $nin: ['Failed', 'Cancelled'] } }
                            ]
                        },
                        { status: { $ne: 'Failed' } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: { $toDouble: '$finalAmount' } }
                }
            }
        ]);

        res.render('adminOrders', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            status,
            sortBy,
            sortOrder,
            orderStats,
            title: 'Order Management'
        });

    } catch (error) {
        console.error('Error loading admin orders:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ]
        })
            .populate('userId', 'name email phone')
            .populate({
                path: 'orderItems.product',
                model: 'Product'
            })
            .populate('statusHistory.updatedBy', 'name')
            .lean();

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).render('pageNotFound');
        }

        
        if (order.paymentMethod !== 'COD' && 
            (order.paymentStatus === 'Failed' || order.status === 'Failed')) {
            return res.status(404).render('pageNotFound');
        }

        order.orderItems?.forEach((item, index) => {
            console.log(`Item ${index + 1}:`, {
                hasProduct: !!item.product,
                productId: item.product?._id,
                productName: item.product?.productName,
                hasImages: !!item.product?.ProductImages,
                imageCount: item.product?.ProductImages?.length
            });
        });

        res.render('adminOrderDetails', {
            order,
            title: 'Order Details'
        });
    } catch (error) {
        console.error('Error loading admin order details:', error);
        console.error('Error stack:', error.stack);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;
        const adminId = req.session.admin;
        console.log(adminId)

        if (!adminId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.ADMIN_ACCESS_REQUIRED
            });
        }

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        const order = await Order.findOne({
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ]
        });

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }


        if (order.paymentStatus !== 'Completed' && order.paymentMethod !== 'COD' && status !== 'Cancelled') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.PAYMENT.INCOMPLETE
            });
        }

        
        if (['Cancelled', 'Returned'].includes(order.status)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.ORDER.ALREADY_CANCELLED
            });
        }

        
        if (order.status === 'Delivered' && status !== 'Returned') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.ORDER.ALREADY_DELIVERED
            });
        }

        
        const statusOrder = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
        const currentIndex = statusOrder.indexOf(order.status);
        const newIndex = statusOrder.indexOf(status);

        if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex && status !== 'Cancelled') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.ORDER.INVALID_STATUS_CHANGE
            });
        }

        
        const oldStatus = order.status;
        order.status = status;

        
        if (status === 'Delivered' && oldStatus !== 'Delivered') {
            order.deliveredOn = new Date();
            order.paymentStatus = 'Completed';
        }

        
        order.statusHistory.push({
            status: status,
            updatedBy: adminId,
            note: note || `Status updated from ${oldStatus} to ${status}`
        });

        await order.save();

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.ORDER.STATUS_UPDATED
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.ORDER.UPDATE_FAILED
        });
    }
};


const handleReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action, note } = req.body; 
        const adminId = req.session.admin;

        if (!adminId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.ADMIN_ACCESS_REQUIRED
            });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        const order = await Order.findOne({
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ]
        }).populate('userId');

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }

        if (order.returnStatus !== 'Requested') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.RETURN.NOT_ALLOWED
            });
        }

        if (action === 'approve') {
            
            const refundService = await import('../../services/refundService.js');
            let totalRefundAmount = 0;
            const refundedItems = [];

            for (const item of order.orderItems) {
                if (item.returnStatus === 'Requested' && !item.isRefunded) {
                    
                    const { refundAmount, error } = refundService.calculateItemRefund(item, order);
                    
                    if (error) {
                        console.error(`Error calculating refund for item ${item._id}:`, error);
                        continue;
                    }

                    if (refundAmount > 0) {
                        
                        item.status = 'Returned';
                        item.returnStatus = 'Approved';
                        item.refundAmount = refundAmount;
                        item.isRefunded = true;
                        
                        totalRefundAmount += refundAmount;
                        refundedItems.push({
                            itemId: item._id,
                            amount: refundAmount
                        });

                        
                        const product = await Product.findById(item.product);
                        if (product) {
                            const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
                            if (variantIndex !== -1) {
                                product.variants[variantIndex].quantity += item.quantity;
                                await product.save();
                            }
                        }
                    }
                }
            }

            
            order.totalRefunded = (order.totalRefunded || 0) + totalRefundAmount;

            
            const activeItems = order.orderItems.filter(it => it.status === 'Active');
            if (activeItems.length === 0) {
                order.status = 'Returned';
            }
            
            order.returnStatus = 'Approved';

            
            if (totalRefundAmount > 0) {
                try {
                    const walletService = await import('../../services/walletService.js');
                    await walletService.credit(order.userId._id, totalRefundAmount, {
                        source: 'ORDER_RETURN_REFUND',
                        referenceModel: 'Order',
                        referenceId: order._id,
                        notes: `Refund for returned items in order ${order.orderId}`
                    });
                } catch (walletError) {
                    console.error('Error crediting wallet:', walletError);
                    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                        success: false,
                        message: ERROR_MESSAGES.PAYMENT.REFUND_FAILED
                    });
                }
            }

            
            order.statusHistory.push({
                status: order.status,
                updatedBy: adminId,
                note: `Return approved. Refund of ₹${totalRefundAmount} added to wallet. ${note || ''}`
            });

            await order.save();

            res.json({
                success: true,
                message: SUCCESS_MESSAGES.RETURN.APPROVED,
                refundAmount: totalRefundAmount,
                refundedItems
            });

        } else {
            
            order.returnStatus = 'Rejected';
            order.returnRejectionReason = note || 'No reason provided';

            
            order.orderItems.forEach(item => {
                if (item.returnStatus === 'Requested') {
                    item.returnStatus = 'Rejected';
                }
            });

            
            order.statusHistory.push({
                status: order.status, 
                updatedBy: adminId,
                note: `Return rejected. ${note || 'No reason provided'}`
            });

            await order.save();

            res.json({
                success: true,
                message: SUCCESS_MESSAGES.RETURN.REJECTED
            });
        }

    } catch (error) {
        console.error('Error handling return request:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.RETURN.PROCESS_FAILED
        });
    }
};


const getInventoryData = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'productName';
        const sortOrder = req.query.sortOrder || 'asc';

        
        let searchQuery = {};
        if (search) {
            searchQuery.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { 'brand.brandName': { $regex: search, $options: 'i' } }
            ];
        }

        
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        
        const products = await Product.find(searchQuery)
            .populate('brand', 'brandName')
            .populate('category', 'name')
            .sort(sortObj)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        
        const stockStats = await Product.aggregate([
            {
                $unwind: '$variants'
            },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    lowStockProducts: {
                        $sum: {
                            $cond: [{ $lte: ['$variants.quantity', 10] }, 1, 0]
                        }
                    },
                    outOfStockProducts: {
                        $sum: {
                            $cond: [{ $eq: ['$variants.quantity', 0] }, 1, 0]
                        }
                    },
                    totalStock: { $sum: '$variants.quantity' }
                }
            }
        ]);

        res.render('admin/inventory', {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            search,
            sortBy,
            sortOrder,
            stockStats: stockStats[0] || { totalProducts: 0, lowStockProducts: 0, outOfStockProducts: 0, totalStock: 0 },
            title: 'Inventory Management'
        });

    } catch (error) {
        console.error('Error loading inventory data:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const updateProductStock = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantIndex, quantity } = req.body;

        if (quantity < 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
            });
        }

        if (variantIndex < 0 || variantIndex >= product.variants.length) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        product.variants[variantIndex].quantity = parseInt(quantity);
        await product.save();

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.PRODUCT.STOCK_UPDATED
        });

    } catch (error) {
        console.error('Error updating product stock:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.PRODUCT.UPDATE_FAILED
        });
    }
};


const clearFilters = async (req, res) => {
    try {
        const baseUrl = req.baseUrl + req.path.replace('/clear-filters', '');
        res.redirect(baseUrl);
    } catch (error) {
        console.error('Error clearing filters:', error);
        res.redirect('back');
    }
};

export {
    loadOrders,
    getOrderDetails,
    updateOrderStatus,
    handleReturnRequest,
    getInventoryData,
    updateProductStock,
    clearFilters
};