import puppeteer from 'puppeteer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface Screenshot {
  buffer: Buffer;
  caption: string;
  page: string;
}

async function captureScreenshots(baseUrl: string): Promise<Screenshot[]> {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const screenshots: Screenshot[] = [];
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // 1. New Order Page - Main Form
    console.log('Capturing New Order page...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const screenshot1 = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push({
      buffer: Buffer.from(screenshot1),
      caption: 'New Order Page - Customer Information and Frame Specifications',
      page: 'New Order Form (Top Section)'
    });

    // 2. New Order Page - Payment Section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshot2 = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push({
      buffer: Buffer.from(screenshot2),
      caption: 'Payment Options Section - Credit Card, PayPal, Cash, and Check',
      page: 'New Order Form (Payment Section)'
    });

    // 3. Order List
    console.log('Capturing Order List...');
    await page.goto(`${baseUrl}/orders`, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const screenshot3 = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push({
      buffer: Buffer.from(screenshot3),
      caption: 'Order List - View all orders with search and filter capabilities',
      page: 'Order List'
    });

    console.log(`Captured ${screenshots.length} screenshots`);
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }

  return screenshots;
}

async function generateUserManual(outputPath: string, screenshots: Screenshot[]) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Helper functions
  const addPageHeader = () => {
    doc.fontSize(8)
       .fillColor('#666666')
       .text('CustomPictureFrames.com Order Management System', 50, 20, { align: 'right' });
    doc.moveTo(50, 35).lineTo(562, 35).stroke('#CCCCCC');
  };

  const addPageFooter = (pageNum: number) => {
    doc.fontSize(8)
       .fillColor('#666666')
       .text(`Page ${pageNum}`, 50, 750, { align: 'center' });
  };

  let pageNumber = 1;

  // ============= COVER PAGE =============
  doc.fontSize(32)
     .fillColor('#1a5490')
     .text('CustomPictureFrames.com', 50, 200, { align: 'center' });
  
  doc.fontSize(24)
     .fillColor('#333333')
     .text('Order Management System', 50, 250, { align: 'center' });
  
  doc.fontSize(18)
     .fillColor('#666666')
     .text('User Guide', 50, 290, { align: 'center' });

  doc.moveDown(8);
  doc.fontSize(12)
     .fillColor('#666666')
     .text(`Generated: ${new Date().toLocaleDateString('en-US', { 
       month: 'long', 
       day: 'numeric', 
       year: 'numeric' 
     })}`, { align: 'center' });

  doc.fontSize(10)
     .fillColor('#999999')
     .text('For Internal Use Only', 50, 700, { align: 'center' });

  addPageFooter(pageNumber++);

  // ============= TABLE OF CONTENTS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20)
     .fillColor('#1a5490')
     .text('Table of Contents', 50, 70);

  doc.moveDown(2);
  doc.fontSize(12).fillColor('#333333');

  const toc = [
    { title: '1. Getting Started', page: '3' },
    { title: '2. Creating a New Order', page: '4' },
    { title: '   2.1 Customer Information', page: '4' },
    { title: '   2.2 Frame Specifications', page: '5' },
    { title: '   2.3 Mat Configuration', page: '6' },
    { title: '   2.4 Add-on Services', page: '7' },
    { title: '3. Payment Processing', page: '8' },
    { title: '   3.1 Credit Card Payments (Stripe)', page: '8' },
    { title: '   3.2 PayPal Invoices', page: '9' },
    { title: '   3.3 Cash & Check Payments', page: '10' },
    { title: '4. Google Review Requests', page: '11' },
    { title: '5. Order Management', page: '12' },
    { title: '   5.1 Viewing Orders', page: '12' },
    { title: '   5.2 Order Details', page: '13' },
    { title: '   5.3 Making Additional Payments', page: '14' },
    { title: '6. Control Panel (Admin)', page: '15' },
    { title: '7. Tips & Best Practices', page: '16' }
  ];

  toc.forEach(item => {
    const y = doc.y;
    doc.text(item.title, 70, y);
    doc.text(item.page, 500, y, { width: 50, align: 'right' });
    doc.moveDown(0.5);
  });

  addPageFooter(pageNumber++);

  // ============= 1. GETTING STARTED =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20)
     .fillColor('#1a5490')
     .text('1. Getting Started', 50, 70);

  doc.moveDown(1.5);
  doc.fontSize(12).fillColor('#333333');

  doc.text('Welcome to the CustomPictureFrames.com Order Management System. This comprehensive platform streamlines your entire order workflow from initial entry through payment collection and customer follow-up.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('System Overview');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  
  doc.text('The system includes:', { continued: false });
  doc.moveDown(0.3);
  doc.text('• Automated pricing calculation based on materials and dimensions', 70);
  doc.text('• Multiple payment methods (Stripe, PayPal, Cash, Check)', 70);
  doc.text('• Integrated customer review request system (Email & SMS)', 70);
  doc.text('• Real-time order tracking and management', 70);
  doc.text('• ShipStation integration for order fulfillment', 70);
  doc.text('• Configurable pricing and business rules', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Accessing the System');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  doc.text('Navigate to your deployment URL in any modern web browser. The system works on desktop, tablet, and mobile devices.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Main Navigation');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  doc.text('• New Order - Create new custom frame orders', 70);
  doc.text('• Orders - View and manage existing orders', 70);
  doc.text('• Control Panel - Adjust pricing and system settings (password protected)', 70);

  addPageFooter(pageNumber++);

  // ============= 2. CREATING A NEW ORDER =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20)
     .fillColor('#1a5490')
     .text('2. Creating a New Order', 50, 70);

  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');
  doc.text('Creating an order is a simple step-by-step process. All fields are optional, allowing flexibility for partial orders or quotes.');

  // Add screenshot if available
  const newOrderScreenshot = screenshots.find(s => s.page.includes('New Order Form (Top'));
  if (newOrderScreenshot) {
    doc.moveDown(1);
    try {
      const maxWidth = 500;
      const maxHeight = 280;
      doc.image(newOrderScreenshot.buffer, {
        fit: [maxWidth, maxHeight],
        align: 'center'
      });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666')
         .text(newOrderScreenshot.caption, { align: 'center' });
    } catch (error) {
      console.error('Error adding screenshot:', error);
    }
  }

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('2.1 Customer Information');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Required for all orders:');
  doc.moveDown(0.3);
  doc.text('• Customer Name - Full name for order identification', 70);
  doc.text('• Email - For order confirmations and PayPal invoices', 70);
  doc.text('• Phone - For SMS notifications and contact', 70);
  doc.text('• Company - Optional business name', 70);
  doc.text('• PO Number - Optional purchase order reference', 70);

  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: Email is required for PayPal invoices. Phone number is required for SMS review requests.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 2.2 FRAME SPECIFICATIONS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('2.2 Frame Specifications', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Order Type Selection:');
  doc.moveDown(0.3);
  doc.text('• Full Frame - Complete custom frame with moulding (standard markup: 4.5×)', 70);
  doc.text('• Components Only - Individual parts without full frame (higher markup: 5.5×)', 70);
  doc.text('• Samples - Material samples for customer preview ($0 item cost, shipping applies)', 70);

  doc.moveDown(1);
  doc.text('Frame Dimensions:');
  doc.moveDown(0.3);
  doc.text('• Width & Height - Enter in inches (whole numbers or decimals)', 70);
  doc.text('• Moulding SKU - Select from dropdown or search by SKU number', 70);
  doc.text('• Quantity - Number of identical frames (default: 1)', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: The system automatically calculates United Inches (width + height) and applies corresponding pricing tiers.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 2.3 MAT CONFIGURATION =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('2.3 Mat Configuration', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('The system supports up to 4 mat layers for complex framing projects.');

  doc.moveDown(1);
  doc.text('Mat Fields (per layer):');
  doc.moveDown(0.3);
  doc.text('• Mat SKU - Select from material dropdown', 70);
  doc.text('• Top Border - Opening size top margin', 70);
  doc.text('• Bottom Border - Opening size bottom margin', 70);
  doc.text('• Left Border - Opening size left margin', 70);
  doc.text('• Right Border - Opening size right margin', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Fraction Support');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  doc.text('Mat border fields accept fractions and decimals:');
  doc.moveDown(0.3);
  doc.text('• "1/2" = 0.5 inches', 70);
  doc.text('• "16 1/2" or "16-1/2" = 16.5 inches', 70);
  doc.text('• "2.75" = 2.75 inches', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: Leave mat fields empty if no mat is needed. Each mat layer is completely optional.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 2.4 ADD-ON SERVICES =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('2.4 Add-on Services & Options', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Glazing & Protection:');
  doc.moveDown(0.3);
  doc.text('• Acrylic Type - Select from dropdown (Clear, Non-Glare, UV, etc.)', 70);
  doc.text('• Backing - Foam core, corrugated, or other backing materials', 70);

  doc.moveDown(1);
  doc.text('Special Services:');
  doc.moveDown(0.3);
  doc.text('• Drymount - Professional mounting service', 70);
  doc.text('• Float - Floating mount style', 70);
  doc.text('• Stretching - Canvas stretching service', 70);
  doc.text('• Foamboard Cutting - Custom cutting service', 70);

  doc.moveDown(1);
  doc.text('Shipping & Delivery:');
  doc.moveDown(0.3);
  doc.text('• Delivery Method - Pickup, UPS Ground, Priority Mail, etc.', 70);
  doc.text('• Rush Processing - Expedited handling ($50 fee)', 70);

  doc.moveDown(1);
  doc.text('Pricing Adjustments:');
  doc.moveDown(0.3);
  doc.text('• Discount - Enter as dollar amount ($10) or percentage (10%)', 70);
  doc.text('• Description/Notes - Internal notes and special instructions', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: All pricing updates in real-time as you make selections. Review the pricing summary before submitting.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 3. PAYMENT PROCESSING =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('3. Payment Processing', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('The system supports four payment methods to accommodate different customer preferences and workflows.');

  // Add payment screenshot if available
  const paymentScreenshot = screenshots.find(s => s.page.includes('Payment Section'));
  if (paymentScreenshot) {
    doc.moveDown(1);
    try {
      const maxWidth = 500;
      const maxHeight = 250;
      doc.image(paymentScreenshot.buffer, {
        fit: [maxWidth, maxHeight],
        align: 'center'
      });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666')
         .text(paymentScreenshot.caption, { align: 'center' });
    } catch (error) {
      console.error('Error adding payment screenshot:', error);
    }
  }

  addPageFooter(pageNumber++);

  // ============= 3.1 CREDIT CARD PAYMENTS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('3.1 Credit Card Payments (Stripe)', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Process credit card payments securely through Stripe. The interface functions as a vendor terminal for processing different customer cards.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Payment Process:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Select "Credit Card" as the payment method', 70);
  doc.moveDown(0.3);
  doc.text('2. The payment amount defaults to the full order total', 70);
  doc.moveDown(0.3);
  doc.text('3. Adjust the amount for partial/deposit payments if needed', 70);
  doc.moveDown(0.3);
  doc.text('4. Enter the customer\'s card information:', 70);
  doc.text('   • Card number', 90);
  doc.text('   • Expiration date (MM/YY)', 90);
  doc.text('   • CVC security code', 90);
  doc.moveDown(0.3);
  doc.text('5. Click "Create Order" to process payment and save the order', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Important Notes:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• The card form clears after each transaction (vendor terminal mode)', 70);
  doc.text('• Payment is processed immediately upon order creation', 70);
  doc.text('• Partial payments are allowed - remaining balance tracked automatically', 70);
  doc.text('• All transactions are secure and PCI-compliant through Stripe', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#dc2626');
  doc.text('⚠️ Important: The payment amount must match the order total or be less for partial payments. The system prevents stale payment amounts.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 3.2 PAYPAL INVOICES =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('3.2 PayPal Invoices', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Send professional PayPal invoices directly to customers for remote payment. Perfect for customers who prefer to pay later or need formal invoicing.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('How It Works:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Select "PayPal Invoice" as the payment method', 70);
  doc.moveDown(0.3);
  doc.text('2. Create the order (no immediate payment required)', 70);
  doc.moveDown(0.3);
  doc.text('3. Navigate to the order detail page', 70);
  doc.moveDown(0.3);
  doc.text('4. Click "Send PayPal Invoice" to email invoice to customer', 70);
  doc.moveDown(0.3);
  doc.text('5. Customer receives email with secure PayPal payment link', 70);
  doc.moveDown(0.3);
  doc.text('6. System automatically updates order balance when payment received', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Automatic Payment Tracking:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Webhook integration receives payment notifications from PayPal', 70);
  doc.text('• Order balance updates automatically when customer pays', 70);
  doc.text('• ShipStation sync deferred until payment confirmed (prevents shipping unpaid orders)', 70);
  doc.text('• Payment status visible in real-time on order detail page', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: Customer email is required for PayPal invoices. Ensure email is entered before creating the order.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 3.3 CASH & CHECK =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('3.3 Cash & Check Payments', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Record manual payments received in person or by mail.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Cash Payments:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Select "Cash" as the payment method', 70);
  doc.moveDown(0.3);
  doc.text('2. Enter the amount received (can be partial payment)', 70);
  doc.moveDown(0.3);
  doc.text('3. Create the order - balance tracked if partial payment', 70);
  doc.moveDown(0.3);
  doc.text('4. Order marked as paid if full amount received', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Check Payments:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Select "Check" as the payment method', 70);
  doc.moveDown(0.3);
  doc.text('2. Enter check number and amount in payment fields', 70);
  doc.moveDown(0.3);
  doc.text('3. Create the order', 70);
  doc.moveDown(0.3);
  doc.text('4. Record additional check details in order notes if needed', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Additional Payments:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('For partial payments, you can collect additional payments later:');
  doc.moveDown(0.3);
  doc.text('• Navigate to order detail page', 70);
  doc.text('• Click "Collect Payment" button', 70);
  doc.text('• Select payment method and amount', 70);
  doc.text('• Submit - balance automatically updated', 70);

  addPageFooter(pageNumber++);

  // ============= 4. GOOGLE REVIEW REQUESTS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('4. Google Review Requests', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Easily request customer reviews to build your online reputation. The system supports both email and SMS delivery for maximum convenience.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Sending Review Requests:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Two convenient locations to send requests:');
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor('#1a5490').text('From New Order Page:');
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#333333');
  doc.text('• After creating an order, use the prominent "Request Google Review" button', 70);
  doc.text('• Enter customer name, email, and/or phone number', 70);
  doc.text('• Check SMS consent if customer agreed to receive text messages', 70);
  doc.text('• Click "Send Review Request"', 70);

  doc.moveDown(1);
  doc.fontSize(12).fillColor('#1a5490').text('From Order Detail Page:');
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#333333');
  doc.text('• Navigate to any order\'s detail page', 70);
  doc.text('• Click "Request Google Review" button', 70);
  doc.text('• Customer information pre-filled from order', 70);
  doc.text('• Send via email, SMS, or both', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Delivery Methods:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Email (via Resend) - Professional branded email with direct review link', 70);
  doc.text('• SMS (via Twilio) - Quick text message with review link', 70);
  doc.text('• Both - Maximize response rate with dual delivery', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: SMS has higher open rates but requires customer consent. Email is always safe to send. For best results, send both.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 5. ORDER MANAGEMENT =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('5. Order Management', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Track, search, and manage all orders from the centralized order list.');

  // Add order list screenshot if available
  const orderListScreenshot = screenshots.find(s => s.page.includes('Order List'));
  if (orderListScreenshot) {
    doc.moveDown(1);
    try {
      const maxWidth = 500;
      const maxHeight = 280;
      doc.image(orderListScreenshot.buffer, {
        fit: [maxWidth, maxHeight],
        align: 'center'
      });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666')
         .text(orderListScreenshot.caption, { align: 'center' });
    } catch (error) {
      console.error('Error adding order list screenshot:', error);
    }
  }

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('5.1 Viewing Orders');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Navigate to "Orders" in the main menu to access the order list.');

  doc.moveDown(1);
  doc.text('Search & Filter:');
  doc.moveDown(0.3);
  doc.text('• Search by customer name, email, or order ID', 70);
  doc.text('• Filter by payment status (Paid, Unpaid, Partial)', 70);
  doc.text('• Sort by date, customer, or amount', 70);

  doc.moveDown(1);
  doc.text('Order Information Displayed:');
  doc.moveDown(0.3);
  doc.text('• Order ID and creation date', 70);
  doc.text('• Customer name and contact info', 70);
  doc.text('• Order total and balance remaining', 70);
  doc.text('• Payment status badge', 70);
  doc.text('• Payment method used', 70);

  addPageFooter(pageNumber++);

  // ============= 5.2 ORDER DETAILS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('5.2 Order Details', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Click any order to view complete details and take actions.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Available Information:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Complete customer information', 70);
  doc.text('• Frame specifications (dimensions, moulding, mats)', 70);
  doc.text('• Add-on services and special requests', 70);
  doc.text('• Itemized pricing breakdown', 70);
  doc.text('• Payment history and remaining balance', 70);
  doc.text('• Order notes and description', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Available Actions:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Collect Payment - Record additional payments', 70);
  doc.text('• Send PayPal Invoice - Email payment request to customer', 70);
  doc.text('• Request Google Review - Send review request', 70);
  doc.text('• Download PDF - Generate order summary PDF', 70);
  doc.text('• Edit Order - Modify order details (if needed)', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Payment History:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('View all payments made toward the order:');
  doc.moveDown(0.3);
  doc.text('• Payment date and time', 70);
  doc.text('• Payment method', 70);
  doc.text('• Amount paid', 70);
  doc.text('• Transaction ID (for electronic payments)', 70);

  addPageFooter(pageNumber++);

  // ============= 5.3 ADDITIONAL PAYMENTS =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(16).fillColor('#1a5490').text('5.3 Making Additional Payments', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('For orders with remaining balances, you can collect additional payments at any time.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Payment Collection Process:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Navigate to the order detail page', 70);
  doc.moveDown(0.3);
  doc.text('2. Click "Collect Payment" button', 70);
  doc.moveDown(0.3);
  doc.text('3. Payment dialog opens showing:', 70);
  doc.text('   • Current balance remaining', 90);
  doc.text('   • Payment method options', 90);
  doc.text('   • Amount input (defaults to full balance)', 90);
  doc.moveDown(0.3);
  doc.text('4. Select payment method:', 70);
  doc.text('   • Credit Card - Process card payment immediately', 90);
  doc.text('   • Cash - Record cash payment', 90);
  doc.text('   • Check - Record check payment with number', 90);
  doc.text('   • PayPal - Send invoice to customer', 90);
  doc.moveDown(0.3);
  doc.text('5. Enter payment amount (can be partial)', 70);
  doc.moveDown(0.3);
  doc.text('6. Submit payment', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Automatic Balance Updates:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Order balance recalculated immediately', 70);
  doc.text('• Payment history updated with new transaction', 70);
  doc.text('• Status changes to "Paid" when balance reaches $0', 70);
  doc.text('• ShipStation syncs automatically for paid orders', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#d97706');
  doc.text('💡 Tip: You can collect multiple partial payments. The system tracks all transactions and maintains accurate balance information.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 6. CONTROL PANEL =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('6. Control Panel (Admin)', 50, 70);
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#333333');

  doc.text('The control panel allows authorized staff to configure pricing and business rules without code changes. Access is password-protected.');

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Accessing the Control Panel:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('1. Navigate to "Control Panel" in the main menu', 70);
  doc.moveDown(0.3);
  doc.text('2. Enter the admin password when prompted', 70);
  doc.moveDown(0.3);
  doc.text('3. Access granted - configuration options available', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Configurable Settings:');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('Markup Rates:');
  doc.moveDown(0.3);
  doc.text('• Full Frame Markup - Default: 4.5× (450%)', 70);
  doc.text('• Components Markup - Default: 5.5× (550%)', 70);

  doc.moveDown(1);
  doc.text('Add-on Service Pricing:');
  doc.moveDown(0.3);
  doc.text('• Drymount fee', 70);
  doc.text('• Float mounting fee', 70);
  doc.text('• Canvas stretching fee', 70);
  doc.text('• Foamboard cutting fee', 70);
  doc.text('• Rush processing fee', 70);

  doc.moveDown(1);
  doc.text('Shipping Rates:');
  doc.moveDown(0.3);
  doc.text('• Tiered shipping by united inches', 70);
  doc.text('• Minimum shipping charge', 70);
  doc.text('• Pickup/local delivery handling', 70);

  doc.moveDown(1);
  doc.text('Sales Tax:');
  doc.moveDown(0.3);
  doc.text('• Tax rate percentage', 70);
  doc.text('• Taxable/non-taxable item configuration', 70);

  doc.moveDown(1);
  doc.fontSize(10).fillColor('#dc2626');
  doc.text('⚠️ Important: Changes take effect immediately for new orders. Existing orders retain their original pricing.', 70, doc.y, { width: 480 });

  addPageFooter(pageNumber++);

  // ============= 7. TIPS & BEST PRACTICES =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('7. Tips & Best Practices', 50, 70);
  doc.moveDown(1.5);

  doc.fontSize(14).fillColor('#1a5490').text('Order Entry Efficiency');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Use the moulding search to quickly find SKUs', 70);
  doc.text('• Tab through fields for faster data entry', 70);
  doc.text('• Watch the real-time pricing update as you work', 70);
  doc.text('• Save partial orders as quotes by skipping payment', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Payment Best Practices');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Always verify the payment amount before processing', 70);
  doc.text('• Use PayPal invoices for remote/phone orders', 70);
  doc.text('• Record check numbers in payment reference field', 70);
  doc.text('• Accept partial deposits to secure larger orders', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Customer Communication');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Request reviews after successful order completion', 70);
  doc.text('• Send both email and SMS for maximum response', 70);
  doc.text('• Always get SMS consent before sending text messages', 70);
  doc.text('• Use order notes for special instructions to production', 70);

  doc.moveDown(1);
  doc.fontSize(14).fillColor('#1a5490').text('Order Management');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Check order list daily for pending payments', 70);
  doc.text('• Follow up on unpaid PayPal invoices after 48 hours', 70);
  doc.text('• Use search function to quickly locate customer orders', 70);
  doc.text('• Download PDF summaries for production/shipping', 70);

  doc.moveDown(1.5);
  doc.fontSize(14).fillColor('#1a5490').text('System Integration');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');

  doc.text('• Paid orders automatically sync to ShipStation', 70);
  doc.text('• PayPal payments update automatically via webhooks', 70);
  doc.text('• Email confirmations sent automatically on order creation', 70);
  doc.text('• All payments are securely processed and logged', 70);

  doc.moveDown(2);
  doc.fontSize(10).fillColor('#666666');
  doc.text('For technical support or questions, contact your system administrator.', { align: 'center' });

  addPageFooter(pageNumber++);

  // ============= FINAL PAGE - QUICK REFERENCE =============
  doc.addPage();
  addPageHeader();

  doc.fontSize(20).fillColor('#1a5490').text('Quick Reference Card', 50, 70);
  doc.moveDown(1.5);

  // Create a bordered reference card
  doc.rect(50, doc.y, 495, 600).stroke('#1a5490');
  const cardY = doc.y + 20;

  doc.fontSize(12).fillColor('#1a5490').text('NEW ORDER CHECKLIST', 70, cardY);
  doc.fontSize(10).fillColor('#333333');
  doc.text('☐ Customer Name, Email, Phone', 70, cardY + 25);
  doc.text('☐ Frame Width & Height', 70, cardY + 45);
  doc.text('☐ Moulding SKU', 70, cardY + 65);
  doc.text('☐ Mat Configuration (if needed)', 70, cardY + 85);
  doc.text('☐ Acrylic & Backing Selection', 70, cardY + 105);
  doc.text('☐ Add-on Services', 70, cardY + 125);
  doc.text('☐ Delivery Method', 70, cardY + 145);
  doc.text('☐ Review Pricing Summary', 70, cardY + 165);
  doc.text('☐ Select Payment Method', 70, cardY + 185);
  doc.text('☐ Process Payment', 70, cardY + 205);
  doc.text('☐ Create Order', 70, cardY + 225);

  doc.fontSize(12).fillColor('#1a5490').text('PAYMENT METHODS', 320, cardY);
  doc.fontSize(10).fillColor('#333333');
  doc.text('Credit Card - Immediate processing', 320, cardY + 25);
  doc.text('PayPal - Send invoice to customer', 320, cardY + 45);
  doc.text('Cash - Record manual payment', 320, cardY + 65);
  doc.text('Check - Record check payment', 320, cardY + 85);

  doc.fontSize(12).fillColor('#1a5490').text('SHORTCUTS', 320, cardY + 120);
  doc.fontSize(10).fillColor('#333333');
  doc.text('Fraction entry: 16 1/2 or 16-1/2', 320, cardY + 145);
  doc.text('Discount: $10 or 10%', 320, cardY + 165);
  doc.text('Search: Use dropdown search', 320, cardY + 185);

  doc.fontSize(12).fillColor('#1a5490').text('COMMON WORKFLOWS', 70, cardY + 270);
  doc.fontSize(10).fillColor('#333333');
  doc.text('Phone Order → Enter details → PayPal Invoice → Email customer', 70, cardY + 295);
  doc.text('In-Person → Enter details → Credit Card → Create order', 70, cardY + 315);
  doc.text('Partial Payment → Create order → Collect Payment later', 70, cardY + 335);
  doc.text('Sample Order → Set order type to Sample → Choose shipping', 70, cardY + 355);

  doc.fontSize(12).fillColor('#1a5490').text('AFTER ORDER CREATION', 70, cardY + 395);
  doc.fontSize(10).fillColor('#333333');
  doc.text('✓ Request Google Review (Email + SMS)', 70, cardY + 420);
  doc.text('✓ Send PayPal Invoice (if applicable)', 70, cardY + 440);
  doc.text('✓ Download PDF for production', 70, cardY + 460);
  doc.text('✓ Monitor payment status', 70, cardY + 480);

  doc.fontSize(12).fillColor('#1a5490').text('SUPPORT', 70, cardY + 530);
  doc.fontSize(10).fillColor('#333333');
  doc.text('Questions? Contact your system administrator', 70, cardY + 555);

  addPageFooter(pageNumber);

  // Finalize PDF
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  try {
    console.log('Starting user manual generation...');
    
    const baseUrl = process.env.REPL_URL || 'http://localhost:5000';
    const outputPath = path.join(process.cwd(), 'CustomPictureFrames_User_Manual.pdf');

    console.log(`Using base URL: ${baseUrl}`);
    
    let screenshots: Screenshot[] = [];
    
    // Try to capture screenshots, but continue without them if it fails
    try {
      console.log('Attempting to capture screenshots...');
      screenshots = await captureScreenshots(baseUrl);
      console.log(`✓ Captured ${screenshots.length} screenshots`);
    } catch (screenshotError) {
      console.warn('⚠️  Screenshot capture failed (Puppeteer may not be available in this environment)');
      console.warn('   Continuing with text-only manual...');
    }
    
    // Generate PDF
    console.log('Generating PDF...');
    await generateUserManual(outputPath, screenshots);
    
    console.log(`✅ User manual generated successfully!`);
    console.log(`📄 Location: ${outputPath}`);
    if (screenshots.length > 0) {
      console.log(`📖 The manual includes ${screenshots.length} screenshots and covers:`);
    } else {
      console.log(`📖 The manual (text-only version) covers:`);
    }
    console.log('   - Getting Started');
    console.log('   - Creating Orders (Customer Info, Frame Specs, Mats, Add-ons)');
    console.log('   - Payment Processing (Stripe, PayPal, Cash, Check)');
    console.log('   - Google Review Requests');
    console.log('   - Order Management');
    console.log('   - Control Panel Administration');
    console.log('   - Tips & Best Practices');
    console.log('   - Quick Reference Card');
    
  } catch (error) {
    console.error('Error generating user manual:', error);
    process.exit(1);
  }
}

export { generateUserManual, captureScreenshots };

// Run if called directly (ES module style)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
