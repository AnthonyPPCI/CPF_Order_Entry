import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

async function generateQuickGuide(outputPath: string) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 40, bottom: 40, left: 50, right: 50 }
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // ============= PAGE 1 =============
  // Header
  doc.fontSize(24)
     .fillColor('#1a5490')
     .text('What\'s New: Digital Order System', { align: 'center' });
  
  doc.fontSize(10)
     .fillColor('#666666')
     .text('Quick Guide for Team Members', { align: 'center' });
  
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke('#CCCCCC');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333333');
  doc.text('This replaces your Google Sheet. Order entry works the same, but now with automated payments, review requests, and order tracking.');

  doc.moveDown(1.5);

  // 1. AUTOMATED PAYMENTS
  doc.fontSize(16).fillColor('#1a5490').text('1. Payment Processing (New!)');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  
  doc.text('Instead of manually tracking payments, the system processes them automatically:');
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor('#1a5490').text('Credit Card (Stripe):');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• Select "Credit Card" payment method', 70);
  doc.text('• Enter card details directly (works like a card terminal)', 70);
  doc.text('• Payment processes immediately when you create order', 70);
  doc.text('• Card form clears after each transaction (prevents duplicate charges)', 70);
  
  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#1a5490').text('PayPal Invoice:');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• Select "PayPal Invoice" (no payment needed at order creation)', 70);
  doc.text('• After creating order, go to order detail page → "Send PayPal Invoice"', 70);
  doc.text('• Customer gets email with payment link', 70);
  doc.text('• System updates balance automatically when they pay', 70);

  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#1a5490').text('Cash/Check:');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• Select "Cash" or "Check" and enter amount received', 70);
  doc.text('• System tracks balance if partial payment', 70);

  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#1a5490').text('Partial Payments:');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• Take deposits at order creation, collect balance later', 70);
  doc.text('• From order detail page: "Collect Payment" button', 70);
  doc.text('• All payments tracked automatically', 70);

  doc.moveDown(1.5);

  // 2. GOOGLE REVIEWS
  doc.fontSize(16).fillColor('#1a5490').text('2. Google Review Requests (New!)');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  
  doc.text('Send review requests to build online reputation:');
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#333333');
  doc.text('After creating order:', 70);
  doc.text('• Click "Request Google Review" button (right on the order form)', 80);
  doc.text('• System sends email + SMS with review link', 80);
  doc.text('• Customer gets frictionless review request', 80);
  
  doc.moveDown(0.5);
  doc.text('Or from order detail page:', 70);
  doc.text('• Navigate to any order → "Request Google Review"', 80);
  doc.text('• Customer info pre-filled', 80);

  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#d97706');
  doc.text('💡 Tip: Send both email and SMS for best response rate. Always get SMS consent first.', 70, doc.y, { width: 480 });

  // ============= PAGE 2 =============
  doc.addPage();

  doc.fontSize(16).fillColor('#1a5490').text('3. Order Management System (New!)', 50, 50);
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  
  doc.text('All orders saved automatically. No more lost spreadsheets.');
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor('#1a5490').text('Order List (Navigate to "Orders"):');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• Search by customer name, email, or order ID', 70);
  doc.text('• See payment status at a glance (Paid/Unpaid/Partial)', 70);
  doc.text('• Click any order to view details', 70);

  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#1a5490').text('Order Detail Page:');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('• View complete order specs and pricing breakdown', 70);
  doc.text('• See payment history', 70);
  doc.text('• Collect additional payments', 70);
  doc.text('• Send PayPal invoices', 70);
  doc.text('• Request Google reviews', 70);
  doc.text('• Download PDF for production', 70);

  doc.moveDown(1.5);

  doc.fontSize(16).fillColor('#1a5490').text('4. Automated Features (Background)');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333333');
  
  doc.text('These happen automatically - you don\'t need to do anything:');
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#333333');
  doc.text('✓ Real-time pricing updates as you enter order details', 70);
  doc.text('✓ Email confirmations sent when orders created', 70);
  doc.text('✓ Paid orders sync to ShipStation automatically', 70);
  doc.text('✓ PayPal payments update order balance via webhooks', 70);
  doc.text('✓ Balance tracking for partial payments', 70);

  doc.moveDown(1.5);

  // QUICK WORKFLOW COMPARISON
  doc.fontSize(16).fillColor('#1a5490').text('Workflow Comparison');
  doc.moveDown(0.5);

  // Old way
  doc.fontSize(12).fillColor('#999999').text('OLD (Google Sheet):');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666666');
  doc.text('1. Fill out spreadsheet row', 70);
  doc.text('2. Manually calculate pricing', 70);
  doc.text('3. Process payment externally', 70);
  doc.text('4. Update spreadsheet with payment status', 70);
  doc.text('5. Email customer manually', 70);
  doc.text('6. Hope they leave a review', 70);

  doc.moveDown(1);

  // New way
  doc.fontSize(12).fillColor('#1a5490').text('NEW (Digital System):');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#333333');
  doc.text('1. Enter order details (pricing calculates automatically)', 70);
  doc.text('2. Process payment (credit card/PayPal/cash) in same screen', 70);
  doc.text('3. Click "Request Google Review"', 70);
  doc.text('4. Done. System handles: email, ShipStation, tracking', 70);

  doc.moveDown(2);

  // KEY DIFFERENCES BOX
  doc.rect(50, doc.y, 495, 145).fillAndStroke('#f0f9ff', '#1a5490');
  const boxY = doc.y + 15;
  
  doc.fontSize(12).fillColor('#1a5490').text('Key Differences from Google Sheet', 70, boxY);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#333333');
  
  doc.text('✓ Payments process in-app (no external terminals/manual tracking)', 70, doc.y + 10);
  doc.text('✓ PayPal invoices send with one click (automatic payment tracking)', 70);
  doc.text('✓ Google review requests via email + SMS (builds reputation)', 70);
  doc.text('✓ All orders searchable/retrievable (no more scrolling through sheets)', 70);
  doc.text('✓ Partial payments tracked automatically (no manual math)', 70);
  doc.text('✓ ShipStation sync (paid orders appear automatically)', 70);

  doc.moveDown(2);

  // FOOTER
  doc.fontSize(10).fillColor('#666666');
  doc.text('Everything else works the same: enter frame specs, select mats, add services.', { align: 'center' });
  doc.fontSize(9).fillColor('#999999');
  doc.text('Questions? Ask your system admin or refer to the full manual.', { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  const outputPath = path.join(process.cwd(), 'CustomPictureFrames_Quick_Guide.pdf');
  
  console.log('Generating quick guide...');
  await generateQuickGuide(outputPath);
  
  console.log('✅ Quick guide generated!');
  console.log(`📄 Location: ${outputPath}`);
  console.log('📖 2 pages covering only NEW features:');
  console.log('   - Payment Processing (Stripe, PayPal, Cash/Check)');
  console.log('   - Google Review Requests');
  console.log('   - Order Management System');
  console.log('   - Workflow Comparison (Old vs New)');
}

export { generateQuickGuide };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
