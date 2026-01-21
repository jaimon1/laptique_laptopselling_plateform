import express from 'express';
import * as adminController from '../../controllers/admin/adminControl.js';
import { adminAuth,errorHandler } from '../../middilwares/auth.js';
import * as userController from '../../controllers/admin/userController.js';
import * as categoryController from '../../controllers/admin/categoryController.js';
import * as productController from '../../controllers/admin/productControl.js';
import { uploadDisk, uploads } from '../../helpers/multer.js';
import * as brandController from '../../controllers/admin/brandController.js';
import * as adminOrderController from '../../controllers/admin/adminOrderController.js';
import * as couponController from '../../controllers/admin/couponController.js';
import * as referralController from '../../controllers/admin/referralController.js';
import * as salesReportController from '../../controllers/admin/salesReportController.js';
import * as dashboardController from '../../controllers/admin/dashboardController.js';

const router = express.Router();

router.get('/pageError', adminController.pageError);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.registerLogin);
router.get('/', adminAuth, adminController.dashboard);
router.get('/logout', adminController.logoutPage);

router.get('/api/dashboard/stats', adminAuth, dashboardController.getDashboardStats);
router.get('/api/dashboard/chart', adminAuth, dashboardController.getChartData);
router.get('/api/dashboard/top-products', adminAuth, dashboardController.getTopProducts);
router.get('/api/dashboard/top-categories', adminAuth, dashboardController.getTopCategories);
router.get('/api/dashboard/top-brands', adminAuth, dashboardController.getTopBrands);

router.get('/users', adminAuth, userController.userPage);
router.get('/notFound', userController.notFound);
router.patch('/blockCustomer', adminAuth, userController.blockUsers);
router.patch('/unBlockCustomer', adminAuth, userController.unBlockUsers);

router.get('/category', adminAuth, categoryController.categoryInfo);
router.get('/addCategory', adminAuth, categoryController.loadCategory);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.patch('/List', adminAuth, categoryController.listCategory);
router.patch('/unList', adminAuth, categoryController.unlistCategory);
router.delete('/deleteCategory', adminAuth, categoryController.deleteCategory);
router.post('/addCatedoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);

router.get('/brands', adminAuth, brandController.loadBrand);
router.post('/createBrand', adminAuth, uploads.single('logo'), brandController.createBrand);
router.get('/createBrand', adminAuth, brandController.loadCreateBrand);
router.patch('/blockBrand', adminAuth, brandController.blockBrand);
router.patch('/unBlockBrand', adminAuth, brandController.unBlockBrand);
router.delete('/deleteBrand', adminAuth, brandController.deleteBrand);

router.get('/loadProduct', adminAuth, productController.loadProductList);
router.get("/addProduct", adminAuth, productController.loadAddProduct)
router.post('/addProduct', uploadDisk.array('productImages', 5), productController.addProduct);
router.patch('/blockProduct', adminAuth, productController.blockProduct);
router.patch('/unblockProduct', adminAuth, productController.unblockProduct);
router.delete("/deleteProduct", adminAuth, productController.deleteProduct);
router.get('/editProduct/:id', adminAuth, productController.loadeditProduct);
router.post('/editProduct/:id', uploadDisk.array('productImages', 5), productController.editProduct);

router.get('/orders', adminAuth, adminOrderController.loadOrders);
router.get('/order/:orderId', adminAuth, adminOrderController.getOrderDetails);
router.post('/order/:orderId/status', adminAuth, adminOrderController.updateOrderStatus);
router.post('/order/:orderId/return', adminAuth, adminOrderController.handleReturnRequest);
router.get('/orders/clear-filters', adminAuth, adminOrderController.clearFilters);

router.get('/inventory', adminAuth, adminOrderController.getInventoryData);
router.post('/inventory/:productId/stock', adminAuth, adminOrderController.updateProductStock);
router.get('/inventory/clear-filters', adminAuth, adminOrderController.clearFilters);

router.get('/loadCoupon',adminAuth,couponController.loadCoupon);
router.post('/createCoupon',adminAuth,couponController.createCoupon);
router.get('/addCoupon',adminAuth,couponController.addCoupon);
router.get('/editCoupon/:id',adminAuth,couponController.loadEditCoupon);
router.put('/editCoupon/:id',adminAuth,couponController.updateCoupon);
router.patch('/toggleCouponStatus/:id',adminAuth,couponController.toggleCouponStatus);
router.delete('/deleteCoupon/:id',adminAuth,couponController.deleteCoupon);

router.get('/referrals', adminAuth, referralController.loadReferralsPage);
router.get('/referrals/stats', adminAuth, referralController.getReferralStats);
router.get('/referrals/details/:userId', adminAuth, referralController.loadReferralDetails);
router.post('/referrals/credit', adminAuth, referralController.manualCreditReward);
router.post('/referrals/revoke', adminAuth, referralController.revokeReward);
router.post('/referrals/settings', adminAuth, referralController.updateSettings);

router.get('/offers', adminAuth, adminController.loadOffersPage);
router.get('/offers/products', adminAuth, productController.getProductsForOffers);
router.get('/offers/categories', adminAuth, categoryController.getCategoriesForOffers);
router.post('/product/add-offer', adminAuth, productController.addProductOffer);
router.post('/product/remove-offer', adminAuth, productController.removeProductOffer);

router.get('/salesReport', adminAuth, salesReportController.loadSalesReport);
router.get('/salesReport/data', adminAuth, salesReportController.getSalesReportData);
router.get('/salesReport/download/excel', adminAuth, salesReportController.downloadExcel);
router.get('/salesReport/download/pdf', adminAuth, salesReportController.downloadPDF);

router.use(errorHandler);
export default router;
