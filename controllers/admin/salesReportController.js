import Order from '../../models/orderSchema.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../constants/index.js';


export const loadSalesReport = async (req, res) => {
    try {
        res.render('salesReport');
    } catch (error) {
        console.error('Error loading sales report:', error);
        res.redirect('/admin/pageError');
    }
};


export const getSalesReportData = async (req, res) => {
    try {
        const { filterType, startDate, endDate, page = 1, limit = 10 } = req.query;

        let dateFilter = {};
        const now = new Date();


        switch (filterType) {
            case 'daily': {
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setHours(0, 0, 0, 0)),
                        $lte: new Date(now.setHours(23, 59, 59, 999))
                    }
                };
                break;
            }
            case 'weekly': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: weekStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'monthly': {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = {
                    createdOn: {
                        $gte: monthStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'yearly': {
                const yearStart = new Date(now.getFullYear(), 0, 1);
                dateFilter = {
                    createdOn: {
                        $gte: yearStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'custom': {
                if (startDate && endDate) {
                    dateFilter = {
                        createdOn: {
                            $gte: new Date(startDate),
                            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                        }
                    };
                }
                break;
            }
            default: {
              
                dateFilter = {};
            }
        }


        const query = {
            ...dateFilter,
            status: 'Delivered',
            $or: [
                { paymentMethod: 'COD' },
                { paymentStatus: 'Completed' }
            ]
        };


        const skip = (page - 1) * limit;
        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderItems.product', 'productName')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalOrders = await Order.countDocuments(query);


        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: { $toDouble: '$finalAmount' } },
                    totalDiscount: { $sum: '$discount' },
                    totalCouponDiscount: {
                        $sum: {
                            $cond: ['$couponApplied', '$couponDetails.discount', 0]
                        }
                    },
                    totalOrders: { $sum: 1 },
                    averageOrderValue: { $avg: { $toDouble: '$finalAmount' } }
                }
            }
        ]);

        const statistics = stats.length > 0 ? stats[0] : {
            totalSales: 0,
            totalDiscount: 0,
            totalCouponDiscount: 0,
            totalOrders: 0,
            averageOrderValue: 0
        };


        const statusBreakdown = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total: { $sum: { $toDouble: '$finalAmount' } }
                }
            }
        ]);


        const paymentBreakdown = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    total: { $sum: { $toDouble: '$finalAmount' } }
                }
            }
        ]);

        res.json({
            success: true,
            orders: orders.map(order => ({
                orderId: order.orderId,
                customerName: order.userId?.name || 'N/A',
                customerEmail: order.userId?.email || 'N/A',
                orderDate: order.createdOn,
                totalAmount: order.totalPrice,
                discount: order.discount,
                couponDiscount: order.couponApplied ? order.couponDetails?.discount || 0 : 0,
                couponCode: order.couponApplied ? order.couponDetails?.code || 'N/A' : 'N/A',
                finalAmount: order.finalAmount,
                paymentMethod: order.paymentMethod,
                status: order.status,
                itemsCount: order.orderItems.length
            })),
            statistics: {
                totalSales: statistics.totalSales.toFixed(2),
                totalDiscount: statistics.totalDiscount.toFixed(2),
                totalCouponDiscount: statistics.totalCouponDiscount.toFixed(2),
                totalOrders: statistics.totalOrders,
                averageOrderValue: statistics.averageOrderValue.toFixed(2)
            },
            statusBreakdown,
            paymentBreakdown,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


export const downloadExcel = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        let dateFilter = {};
        const now = new Date();


        switch (filterType) {
            case 'daily': {
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setHours(0, 0, 0, 0)),
                        $lte: new Date(now.setHours(23, 59, 59, 999))
                    }
                };
                break;
            }
            case 'weekly': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: weekStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'monthly': {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = {
                    createdOn: {
                        $gte: monthStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'yearly': {
                const yearStart = new Date(now.getFullYear(), 0, 1);
                dateFilter = {
                    createdOn: {
                        $gte: yearStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'custom': {
                if (startDate && endDate) {
                    dateFilter = {
                        createdOn: {
                            $gte: new Date(startDate),
                            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                        }
                    };
                }
                break;
            }
            default: {
                
                dateFilter = {};
            }
        }


        const query = {
            ...dateFilter,
            status: 'Delivered',
            $or: [
                { paymentMethod: 'COD' },
                { paymentStatus: 'Completed' }
            ]
        };

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('orderItems.product', 'productName')
            .sort({ createdOn: -1 });


        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');


        worksheet.mergeCells('A1:J1');
        worksheet.getCell('A1').value = 'LapTique Sales Report';
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };


        worksheet.mergeCells('A2:J2');
        worksheet.getCell('A2').value = `Report Generated: ${new Date().toLocaleString()}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };


        worksheet.addRow([]);
        const headerRow = worksheet.addRow([
            'Order ID',
            'Customer Name',
            'Customer Email',
            'Order Date',
            'Total Amount',
            'Discount',
            'Coupon Discount',
            'Coupon Code',
            'Final Amount',
            'Payment Method',
            'Status'
        ]);

        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '6366F1' }
        };
        headerRow.font = { color: { argb: 'FFFFFF' }, bold: true };


        orders.forEach(order => {
            worksheet.addRow([
                order.orderId,
                order.userId?.name || 'N/A',
                order.userId?.email || 'N/A',
                new Date(order.createdOn).toLocaleDateString(),
                order.totalPrice,
                order.discount,
                order.couponApplied ? order.couponDetails?.discount || 0 : 0,
                order.couponApplied ? order.couponDetails?.code || 'N/A' : 'N/A',
                order.finalAmount,
                order.paymentMethod,
                order.status
            ]);
        });


        const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.finalAmount), 0);
        const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0);
        const totalCouponDiscount = orders.reduce((sum, order) =>
            sum + (order.couponApplied ? order.couponDetails?.discount || 0 : 0), 0);


        worksheet.addRow([]);
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders:', orders.length]);
        worksheet.addRow(['Total Sales:', totalSales.toFixed(2)]);
        worksheet.addRow(['Total Discount:', totalDiscount.toFixed(2)]);
        worksheet.addRow(['Total Coupon Discount:', totalCouponDiscount.toFixed(2)]);


        worksheet.columns.forEach(column => {
            column.width = 15;
        });


        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

 
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


export const downloadPDF = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        let dateFilter = {};
        const now = new Date();

        
        switch (filterType) {
            case 'daily': {
                dateFilter = {
                    createdOn: {
                        $gte: new Date(now.setHours(0, 0, 0, 0)),
                        $lte: new Date(now.setHours(23, 59, 59, 999))
                    }
                };
                break;
            }
            case 'weekly': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: weekStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'monthly': {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = {
                    createdOn: {
                        $gte: monthStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'yearly': {
                const yearStart = new Date(now.getFullYear(), 0, 1);
                dateFilter = {
                    createdOn: {
                        $gte: yearStart,
                        $lte: new Date()
                    }
                };
                break;
            }
            case 'custom': {
                if (startDate && endDate) {
                    dateFilter = {
                        createdOn: {
                            $gte: new Date(startDate),
                            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                        }
                    };
                }
                break;
            }
        }

      
        const query = {
            ...dateFilter,
            status: 'Delivered',
            $or: [
                { paymentMethod: 'COD' },
                { paymentStatus: 'Completed' }
            ]
        };

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });


        const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.finalAmount), 0);
        const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0);
        const totalCouponDiscount = orders.reduce((sum, order) =>
            sum + (order.couponApplied ? order.couponDetails?.discount || 0 : 0), 0);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });


        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);

        doc.pipe(res);


        doc.fontSize(20).font('Helvetica-Bold').text('LapTique Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(14).font('Helvetica-Bold').text('Summary');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Orders: ${orders.length}`);
        doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
        doc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
        doc.text(`Total Coupon Discount: ₹${totalCouponDiscount.toFixed(2)}`);
        doc.text(`Net Sales: ₹${(totalSales - totalDiscount - totalCouponDiscount).toFixed(2)}`);
        doc.moveDown(2);


        doc.fontSize(12).font('Helvetica-Bold').text('Order Details');
        doc.moveDown(0.5);


        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 150;
        const col3 = 250;
        const col4 = 350;
        const col5 = 450;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Order ID', col1, tableTop);
        doc.text('Customer', col2, tableTop);
        doc.text('Date', col3, tableTop);
        doc.text('Amount', col4, tableTop);
        doc.text('Status', col5, tableTop);

        doc.moveDown();
        let yPosition = doc.y;


        doc.fontSize(8).font('Helvetica');
        orders.forEach((order) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(order.orderId, col1, yPosition, { width: 90 });
            doc.text(order.userId?.name || 'N/A', col2, yPosition, { width: 90 });
            doc.text(new Date(order.createdOn).toLocaleDateString(), col3, yPosition, { width: 90 });
            doc.text(`₹${order.finalAmount}`, col4, yPosition, { width: 90 });
            doc.text(order.status, col5, yPosition, { width: 90 });

            yPosition += 20;
        });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};
