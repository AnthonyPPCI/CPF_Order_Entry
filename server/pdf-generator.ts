import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface OrderData {
  orderId: string;
  customerName: string;
  email?: string;
  phone?: string;
  frameSku?: string;
  width?: number;
  height?: number;
  quantity?: number;
  mat1Sku?: string;
  mat2Sku?: string;
  mat3Sku?: string;
  mat4Sku?: string;
  acrylic?: string;
  backing?: string;
  description?: string;
  total: string;
  balance: string;
  orderDate?: string;
  isMultiItem?: boolean;
  itemsCount?: number;
  items?: any[];
}

export async function generateOrderPDF(orderData: OrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24)
         .fillColor('#1a5490')
         .text('Custom Picture Frames', { align: 'center' });
      
      doc.fontSize(10)
         .fillColor('#666666')
         .text('6 Shirley Ave, Somerset, NJ | (800) 916-8770', { align: 'center' })
         .text('CustomPictureFrames.com', { align: 'center' })
         .moveDown(2);

      // Order Header
      doc.fontSize(18)
         .fillColor('#000000')
         .text(`Order #${orderData.orderId}`, { underline: true })
         .moveDown();

      // Customer Information
      doc.fontSize(12)
         .fillColor('#1a5490')
         .text('Customer Information', { underline: true })
         .moveDown(0.5);

      doc.fontSize(10)
         .fillColor('#000000')
         .text(`Name: ${orderData.customerName || 'N/A'}`)
         .text(`Email: ${orderData.email || 'N/A'}`)
         .text(`Phone: ${orderData.phone || 'N/A'}`)
         .text(`Order Date: ${orderData.orderDate || new Date().toLocaleDateString()}`)
         .moveDown();

      // Order Details
      doc.fontSize(12)
         .fillColor('#1a5490')
         .text('Order Details', { underline: true })
         .moveDown(0.5);

      doc.fontSize(10)
         .fillColor('#000000');

      if (orderData.isMultiItem && orderData.items && orderData.items.length > 0) {
        doc.text(`Multi-Item Order - ${orderData.itemsCount} items`)
           .moveDown(0.5);
        
        orderData.items.forEach((item, index) => {
          doc.fillColor('#1a5490')
             .text(`Item ${index + 1}:`, { continued: false })
             .fillColor('#000000')
             .text(`  Frame: ${item.frameSku || 'N/A'}`)
             .text(`  Dimensions: ${item.width || 'N/A'}" × ${item.height || 'N/A'}"`)
             .text(`  Quantity: ${item.quantity || 1}`)
             .moveDown(0.3);
        });
      } else {
        if (orderData.frameSku) {
          doc.text(`Frame SKU: ${orderData.frameSku}`)
             .text(`Dimensions: ${orderData.width || 'N/A'}" × ${orderData.height || 'N/A'}"`)
             .text(`Quantity: ${orderData.quantity || 1}`);
        }

        if (orderData.mat1Sku) doc.text(`Mat 1: ${orderData.mat1Sku}`);
        if (orderData.mat2Sku) doc.text(`Mat 2: ${orderData.mat2Sku}`);
        if (orderData.mat3Sku) doc.text(`Mat 3: ${orderData.mat3Sku}`);
        if (orderData.mat4Sku) doc.text(`Mat 4: ${orderData.mat4Sku}`);
        if (orderData.acrylic) doc.text(`Acrylic: ${orderData.acrylic}`);
        if (orderData.backing) doc.text(`Backing: ${orderData.backing}`);
        if (orderData.description) {
          doc.moveDown(0.5)
             .text(`Description: ${orderData.description}`);
        }
      }

      doc.moveDown();

      // Pricing
      doc.fontSize(12)
         .fillColor('#1a5490')
         .text('Pricing', { underline: true })
         .moveDown(0.5);

      doc.fontSize(10)
         .fillColor('#000000')
         .text(`Total: $${orderData.total}`)
         .text(`Balance Due: $${orderData.balance}`)
         .moveDown(2);

      // Footer
      doc.fontSize(8)
         .fillColor('#666666')
         .text('Thank you for your business!', { align: 'center' })
         .text('Every piece we build is custom-made with care.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
