import Joi from 'joi';
import handleJoiError from '../../utils/joiErrorHandler.js';
import { Request, Response, NextFunction } from '../../types/express.js';


const validateUser = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    username: Joi.string().label('Username').optional(),
    firstName: Joi.string().label('First Name').optional(),
    lastName: Joi.string().label('Last Name').optional(),
    name: Joi.string().label('Name').optional(),
    avatar: Joi.string().label('Avatar').optional(),
    password: Joi.string().min(6).label('Password').optional(),
    phone: Joi.string().label('Phone').optional(),
    isAdmin: Joi.boolean().label('Admin access').optional(),
    createdAt: Joi.date().default(Date.now).label('Creation Date'),
    updatedAt: Joi.date().default(Date.now).label('Last Update'),
    picture: Joi.string().label('Picture').optional(),
    sub: Joi.string().label('Sub').optional(),
    email: Joi.string().email().label('Email').optional(),
    email_verified: Joi.boolean().label('Email Verification').optional(),
    wishlists: Joi.string().label('Wishlists').optional(),
    studios: Joi.string().label('Studios').optional(),
    reservations: Joi.string().label('Reservations').optional(),
    cart: Joi.object({
      items: Joi.array().items(
        Joi.object({
          name: Joi.object({
            en: Joi.string().label('Name (English)').required(),
            he: Joi.string().label('Name (Hebrew)').optional(),
          }).label('Name'),
          studioName: Joi.object({
            en: Joi.string().label('Studio Name (English)').optional(),
            he: Joi.string().label('Studio Name (Hebrew)').optional(),
          }).label('Studio Name'),
          price: Joi.number().label('Price').optional(),
          total: Joi.number().label('Total Price').optional(),
          pricePer: Joi.string()
            .valid('hour', 'session', 'unit', 'song')
            .label('Price Per')
            .optional(),
          itemId: Joi.string().label('Item ID').optional(),
          quantity: Joi.number().label('Quantity').optional().default(1),
          bookingDate: Joi.string().label('Booking Date').optional(),
          startTime: Joi.string().label('Start Time').optional(),
          studioId: Joi.string().label('Studio ID').optional(),
          reservationId: Joi.string().label('Reservation ID').optional(),
        })
      ).label('Cart Items'),
    }).label('Shopping Cart').optional(),
    paypalMerchantId: Joi.string().label('PayPal Merchant ID').optional(),
   paypalOnboardingStatus: Joi.string()
     .valid('PENDING', 'COMPLETED', 'FAILED')
     .label('PayPal Onboarding Status')
     .optional(),
   paypalAccountStatus: Joi.object({
     payments_receivable: Joi.boolean()
       .label('Payments Receivable Status')
       .optional(),
     primary_email_confirmed: Joi.boolean()
       .label('Email Confirmation Status')
       .optional(),
     oauth_integrations: Joi.array().items(
       Joi.object({
         status: Joi.string()
           .label('OAuth Integration Status')
           .required(),
         integration_type: Joi.string()
           .label('Integration Type')
           .required()
       })
     ).optional()
   }).label('PayPal Account Status').optional(),
    subscriptionStatus: Joi.string().label('Subscription Status').optional(),
    subscriptionId: Joi.string().label('Subscription ID').optional(),
    sumitCompanyId: Joi.number().label('Sumit Company ID').optional(),
    sumitApiKey: Joi.string().label('Sumit API Key').optional(),
    sumitApiPublicKey: Joi.string().label('Sumit API Public Key').optional(),
    role: Joi.string().valid('user', 'vendor', 'admin').label('User Role').optional(),
    googleCalendar: Joi.object({
      connected: Joi.boolean().optional(),
      accessToken: Joi.string().optional(),
      refreshToken: Joi.string().optional(),
      tokenExpiry: Joi.date().optional(),
      calendarId: Joi.string().optional(),
      lastSyncAt: Joi.date().optional(),
      syncToken: Joi.string().optional()
    }).label('Google Calendar Integration').optional()
 });
  

  const { error } = schema.validate(req.body);
  error ? handleJoiError(error) : next();
};


export default validateUser;
