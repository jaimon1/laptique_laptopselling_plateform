import Coupon from '../models/couponSchema.js';


class CouponService {

    async validateAndApplyCoupon(couponCode, userId, cartTotal) {
        try {
           
            const coupon = await Coupon.findOne({ 
                name: couponCode.toUpperCase().trim() 
            });

            if (!coupon) {
                return {
                    success: false,
                    message: 'Invalid coupon code'
                };
            }

          
            if (!coupon.isActive) {
                return {
                    success: false,
                    message: 'This coupon is no longer active'
                };
            }


            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const expiryDate = new Date(coupon.expireOn);
            expiryDate.setHours(0, 0, 0, 0);

            if (expiryDate < currentDate) {
                return {
                    success: false,
                    message: 'This coupon has expired'
                };
            }

          
            if (cartTotal < coupon.minimumPrice) {
                return {
                    success: false,
                    message: `Minimum purchase amount of ₹${coupon.minimumPrice.toLocaleString()} required to use this coupon`
                };
            }

       
            const totalUsed = coupon.usersUsed.reduce((sum, user) => sum + user.count, 0);
            if (totalUsed >= coupon.usageLimit) {
                return {
                    success: false,
                    message: 'This coupon has reached its usage limit'
                };
            }

           
            const userUsage = coupon.usersUsed.find(
                user => user.userId.toString() === userId.toString()
            );

            if (userUsage && userUsage.count > 0) {
                return {
                    success: false,
                    message: 'You have already used this coupon'
                };
            }

            
            let discountAmount = 0;

            if (coupon.discountType === 'percentage') {
               
                discountAmount = (cartTotal * coupon.discountValue) / 100;

                
                if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                    discountAmount = coupon.maxDiscountAmount;
                }
            } else if (coupon.discountType === 'fixed') {
                
                discountAmount = coupon.discountValue;

               
                if (discountAmount > cartTotal) {
                    discountAmount = cartTotal;
                }
            }

           
            discountAmount = Math.round(discountAmount * 100) / 100;

       
            if (discountAmount <= 0) {
                return {
                    success: false,
                    message: 'Unable to apply discount'
                };
            }

            
            return {
                success: true,
                message: 'Coupon applied successfully',
                coupon: {
                    code: coupon.name,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    discountAmount: discountAmount,
                    finalAmount: Math.max(0, cartTotal - discountAmount)
                }
            };

        } catch (error) {
            console.error('Error validating coupon:', error);
            return {
                success: false,
                message: 'Error validating coupon. Please try again.'
            };
        }
    }


    async markCouponAsUsed(couponCode, userId) {
        try {
            const coupon = await Coupon.findOne({ 
                name: couponCode.toUpperCase().trim() 
            });

            if (!coupon) {
                return { success: false, message: 'Coupon not found' };
            }

   
            const userIndex = coupon.usersUsed.findIndex(
                user => user.userId.toString() === userId.toString()
            );

            if (userIndex !== -1) {
                
                coupon.usersUsed[userIndex].count += 1;
            } else {
               
                coupon.usersUsed.push({
                    userId: userId,
                    count: 1
                });
            }

            await coupon.save();

            return { success: true, message: 'Coupon marked as used' };

        } catch (error) {
            console.error('Error marking coupon as used:', error);
            return { success: false, message: 'Error updating coupon usage' };
        }
    }

   
    async getCouponDetails(couponCode) {
        try {
            const coupon = await Coupon.findOne({ 
                name: couponCode.toUpperCase().trim() 
            }).select('-usersUsed');

            if (!coupon) {
                return { success: false, message: 'Coupon not found' };
            }

            return {
                success: true,
                coupon: {
                    code: coupon.name,
                    description: coupon.description,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    maxDiscountAmount: coupon.maxDiscountAmount,
                    minimumPrice: coupon.minimumPrice,
                    expireOn: coupon.expireOn,
                    isActive: coupon.isActive
                }
            };

        } catch (error) {
            
            return { success: false, message: 'Error fetching coupon details' };
        }
    }
}

export default new CouponService();
