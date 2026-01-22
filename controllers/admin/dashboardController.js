import Order from '../../models/orderSchema.js';
import User from '../../models/userSchema.js';
import Product from '../../models/productSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../constants/index.js';


const getDashboardStats = async (req, res) => {
    try {
        const { period = 'monthly', year, month } = req.query;
        
        
        let dateFilter = {};
        const currentDate = new Date();
        
        if (period === 'yearly' && year) {
            const selectedYear = parseInt(year);
            dateFilter = {
                createdOn: {
                    $gte: new Date(selectedYear, 0, 1),
                    $lt: new Date(selectedYear + 1, 0, 1)
                }
            };
        } else if (period === 'monthly' && year && month) {
            const selectedYear = parseInt(year);
            const selectedMonth = parseInt(month);
            dateFilter = {
                createdOn: {
                    $gte: new Date(selectedYear, selectedMonth, 1),
                    $lt: new Date(selectedYear, selectedMonth + 1, 1)
                }
            };
        } else if (period === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = {
                createdOn: { $gte: weekAgo }
            };
        } else if (period === 'daily') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateFilter = {
                createdOn: { $gte: today }
            };
        } else {
            
            dateFilter = {
                createdOn: {
                    $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
                    $lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                }
            };
        }

        
        const totalUsers = await User.countDocuments({ isAdmin: false });

        
        const orders = await Order.find({
            ...dateFilter,
            $and: [
                { status: { $ne: 'Failed' } },
                {
                    $or: [
                        { paymentMethod: 'COD' },
                        { paymentStatus: 'Completed' },
                        { paymentStatus: 'Pending', status: { $nin: ['Failed', 'Cancelled'] } }
                    ]
                }
            ]
        });

        
        const totalOrders = orders.length;
        const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
        const totalSales = orders
            .filter(o => o.paymentStatus === 'Completed')
            .reduce((sum, order) => sum + parseFloat(order.finalAmount || 0), 0);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalOrders,
                deliveredOrders,
                totalSales: totalSales.toFixed(2)
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const getChartData = async (req, res) => {
    try {
        const { period = 'monthly', year, month } = req.query;
        
        let groupBy, dateFormat, dateRange;
        const currentDate = new Date();
        
        if (period === 'yearly' && year) {
            const selectedYear = parseInt(year);
            groupBy = { month: { $month: '$createdOn' } };
            dateFormat = 'month';
            dateRange = {
                $gte: new Date(selectedYear, 0, 1),
                $lt: new Date(selectedYear + 1, 0, 1)
            };
        } else if (period === 'monthly' && year && month) {
            const selectedYear = parseInt(year);
            const selectedMonth = parseInt(month);
            groupBy = { day: { $dayOfMonth: '$createdOn' } };
            dateFormat = 'day';
            dateRange = {
                $gte: new Date(selectedYear, selectedMonth, 1),
                $lt: new Date(selectedYear, selectedMonth + 1, 1)
            };
        } else if (period === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            groupBy = { day: { $dayOfMonth: '$createdOn' } };
            dateFormat = 'day';
            dateRange = { $gte: weekAgo };
        } else {
            
            groupBy = { day: { $dayOfMonth: '$createdOn' } };
            dateFormat = 'day';
            dateRange = {
                $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
                $lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            };
        }

        
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdOn: dateRange,
                    paymentStatus: 'Completed',
                    $and: [
                        { status: { $ne: 'Failed' } },
                        {
                            $or: [
                                { paymentMethod: 'COD' },
                                { paymentStatus: 'Completed' }
                            ]
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: groupBy,
                    totalSales: { $sum: { $toDouble: '$finalAmount' } }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        
        const ordersData = await Order.aggregate([
            {
                $match: {
                    createdOn: dateRange,
                    $and: [
                        { status: { $ne: 'Failed' } },
                        {
                            $or: [
                                { paymentMethod: 'COD' },
                                { paymentStatus: 'Completed' },
                                { paymentStatus: 'Pending', status: { $nin: ['Failed', 'Cancelled'] } }
                            ]
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        const formatLabel = (data, format) => {
            if (format === 'month') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[data.month - 1];
            } else {
                return data.day.toString();
            }
        };


        const allIds = new Set([
            ...salesData.map(item => JSON.stringify(item._id)),
            ...ordersData.map(item => JSON.stringify(item._id))
        ]);

        const mergedData = Array.from(allIds).map(idStr => {
            const id = JSON.parse(idStr);
            const salesItem = salesData.find(item => JSON.stringify(item._id) === idStr);
            const ordersItem = ordersData.find(item => JSON.stringify(item._id) === idStr);
            
            return {
                id,
                sales: salesItem ? salesItem.totalSales : 0,
                orders: ordersItem ? ordersItem.count : 0
            };
        });

        
        mergedData.sort((a, b) => {
            if (dateFormat === 'month') {
                return a.id.month - b.id.month;
            } else {
                return a.id.day - b.id.day;
            }
        });

        const labels = mergedData.map(item => formatLabel(item.id, dateFormat));
        const sales = mergedData.map(item => item.sales);
        const orders = mergedData.map(item => item.orders);

        res.json({
            success: true,
            chartData: {
                labels,
                sales,
                orders
            }
        });

    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const getTopProducts = async (req, res) => {
    try {
        const { period = 'all', year, month } = req.query;
        
        let dateFilter = {};
        if (period !== 'all') {
            if (period === 'yearly' && year) {
                const selectedYear = parseInt(year);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, 0, 1),
                        $lt: new Date(selectedYear + 1, 0, 1)
                    }
                };
            } else if (period === 'monthly' && year && month) {
                const selectedYear = parseInt(year);
                const selectedMonth = parseInt(month);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, selectedMonth, 1),
                        $lt: new Date(selectedYear, selectedMonth + 1, 1)
                    }
                };
            }
        }

        const topProducts = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'Delivered',
                    paymentStatus: 'Completed'
                }
            },
            { $unwind: '$orderItems' },
            {
                $group: {
                    _id: '$orderItems.product',
                    totalSold: { $sum: '$orderItems.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$orderItems.quantity', '$orderItems.price']
                        }
                    }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        
        const formattedProducts = await Promise.all(
            topProducts.map(async (item, index) => {
                try {
                    const product = await Product.findById(item._id)
                        .populate('brand', 'name')
                        .lean();
                    
                    if (!product) {
                        console.log('Product not found:', item._id);
                        return {
                            rank: index + 1,
                            productId: item._id,
                            productName: 'Product Not Found',
                            brand: 'N/A',
                            totalSold: item.totalSold,
                            totalRevenue: item.totalRevenue.toFixed(2),
                            image: '/images/placeholder.png'
                        };
                    }

                    return {
                        rank: index + 1,
                        productId: item._id,
                        productName: product.productName || 'Unknown Product',
                        brand: product.brand?.name || 'No Brand',
                        totalSold: item.totalSold,
                        totalRevenue: item.totalRevenue.toFixed(2),
                        image: product.ProductImages?.[0] || '/images/placeholder.png'
                    };
                } catch (err) {
                    console.error('Error processing product:', item._id, err);
                    return {
                        rank: index + 1,
                        productId: item._id,
                        productName: 'Error Loading Product',
                        brand: 'N/A',
                        totalSold: item.totalSold,
                        totalRevenue: item.totalRevenue.toFixed(2),
                        image: '/images/placeholder.png'
                    };
                }
            })
        );

        res.json({
            success: true,
            topProducts: formattedProducts
        });

    } catch (error) {
        console.error('Error fetching top products:', error);
        console.error('Error stack:', error.stack);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR, error: error.message });
    }
};


const getTopCategories = async (req, res) => {
    try {
        const { period = 'all', year, month } = req.query;
        
        let dateFilter = {};
        if (period !== 'all') {
            if (period === 'yearly' && year) {
                const selectedYear = parseInt(year);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, 0, 1),
                        $lt: new Date(selectedYear + 1, 0, 1)
                    }
                };
            } else if (period === 'monthly' && year && month) {
                const selectedYear = parseInt(year);
                const selectedMonth = parseInt(month);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, selectedMonth, 1),
                        $lt: new Date(selectedYear, selectedMonth + 1, 1)
                    }
                };
            }
        }

        const topCategories = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'Delivered',
                    paymentStatus: 'Completed'
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.category',
                    totalSold: { $sum: '$orderItems.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$orderItems.quantity', '$orderItems.price']
                        }
                    }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: '$categoryDetails' }
        ]);

        const formattedCategories = topCategories.map((item, index) => ({
            rank: index + 1,
            categoryId: item._id,
            categoryName: item.categoryDetails.name,
            totalSold: item.totalSold,
            totalRevenue: item.totalRevenue.toFixed(2)
        }));

        res.json({
            success: true,
            topCategories: formattedCategories
        });

    } catch (error) {
        console.error('Error fetching top categories:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const getTopBrands = async (req, res) => {
    try {
        const { period = 'all', year, month } = req.query;
        
        let dateFilter = {};
        if (period !== 'all') {
            if (period === 'yearly' && year) {
                const selectedYear = parseInt(year);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, 0, 1),
                        $lt: new Date(selectedYear + 1, 0, 1)
                    }
                };
            } else if (period === 'monthly' && year && month) {
                const selectedYear = parseInt(year);
                const selectedMonth = parseInt(month);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(selectedYear, selectedMonth, 1),
                        $lt: new Date(selectedYear, selectedMonth + 1, 1)
                    }
                };
            }
        }

        const topBrands = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: 'Delivered',
                    paymentStatus: 'Completed'
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.brand',
                    totalSold: { $sum: '$orderItems.quantity' },
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$orderItems.quantity', '$orderItems.price']
                        }
                    }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'brands',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'brandDetails'
                }
            },
            { $unwind: '$brandDetails' }
        ]);

        const formattedBrands = topBrands.map((item, index) => ({
            rank: index + 1,
            brandId: item._id,
            brandName: item.brandDetails?.name || 'Unknown Brand',
            totalSold: item.totalSold,
            totalRevenue: item.totalRevenue.toFixed(2)
        }));

        res.json({
            success: true,
            topBrands: formattedBrands
        });

    } catch (error) {
        console.error('Error fetching top brands:', error);
        console.error('Error stack:', error.stack);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR, error: error.message });
    }
};

export {
    getDashboardStats,
    getChartData,
    getTopProducts,
    getTopCategories,
    getTopBrands
};
