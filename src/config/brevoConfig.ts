
import { BREVO_EMAIL_API_KEY } from '../config/index.js';


const brevo = require('@getbrevo/brevo');
let apiInstance = new brevo.TransactionalEmailsApi();

let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = BREVO_EMAIL_API_KEY;

let sendSmtpEmail = new brevo.SendSmtpEmail();

sendSmtpEmail.subject = "My {{params.subject}}";
sendSmtpEmail.htmlContent = "<html><body><h1>Common: This is my first transactional email {{params.parameter}}</h1></body></html>";
sendSmtpEmail.sender = { "name": "John", "email": "shubham.upadhyay@sendinblue.com" };
sendSmtpEmail.to = [
  { "email": "shubham.upadhyay@sendinblue.com", "name": "shubham upadhyay" }
];
sendSmtpEmail.replyTo = { "email": "shubham.upadhyay@sendinblue.com", "name": "Shubham Upadhyay" };
sendSmtpEmail.headers = { "Some-Custom-Name": "unique-id-1234" };
sendSmtpEmail.params = { "parameter": "My param value", "subject": "common subject" };


apiInstance.sendTransacEmail(sendSmtpEmail).then(function (data: unknown) {
  console.log('API called successfully. Returned data: ' + JSON.stringify(data));
}, function (error: Error) {
  console.error(error);
});
