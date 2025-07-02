import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { PurchaseOrder } from '../entities/purchase-order.entity';

@Injectable()
export class PurchaseOrderPdfService {
  private readonly logger = new Logger(PurchaseOrderPdfService.name);

  constructor(private readonly configService: ConfigService) {}

  async generatePdf(purchaseOrder: PurchaseOrder): Promise<string> {
    try {
      const html = this.generateHtml(purchaseOrder);
      const pdfBuffer = await this.htmlToPdf(html);
      const filePath = await this.savePdfFile(pdfBuffer, purchaseOrder.poNumber);

      this.logger.log(`PDF generated for PO ${purchaseOrder.poNumber}: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to generate PDF for PO ${purchaseOrder.poNumber}`, error.stack);
      throw error;
    }
  }

  private generateHtml(purchaseOrder: PurchaseOrder): string {
    const companyInfo = {
      name: 'PT. StokCerdas Indonesia',
      address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      phone: '+62-21-12345678',
      email: 'info@stokcerdas.com',
    };

    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: purchaseOrder.currency || 'IDR',
      }).format(amount);
    };

    const formatDate = (date: Date | undefined): string => {
      if (!date) return '-';
      return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    const getStatusBadge = (status: string): string => {
      const statusColors = {
        'draft': '#6b7280',
        'pending_approval': '#f59e0b',
        'approved': '#10b981',
        'rejected': '#ef4444',
        'sent_to_supplier': '#3b82f6',
        'acknowledged': '#8b5cf6',
        'partially_received': '#f97316',
        'received': '#059669',
        'closed': '#374151',
        'cancelled': '#dc2626',
      };

      const statusNames = {
        'draft': 'Draft',
        'pending_approval': 'Menunggu Approval',
        'approved': 'Disetujui',
        'rejected': 'Ditolak',
        'sent_to_supplier': 'Dikirim ke Supplier',
        'acknowledged': 'Dikonfirmasi Supplier',
        'partially_received': 'Sebagian Diterima',
        'received': 'Diterima',
        'closed': 'Ditutup',
        'cancelled': 'Dibatalkan',
      };

      const color = statusColors[status] || '#6b7280';
      const name = statusNames[status] || status;

      return `<span style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${name}</span>`;
    };

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Order - ${purchaseOrder.poNumber}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-info {
            text-align: center;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .company-details {
            color: #6b7280;
            font-size: 14px;
          }
          .po-title {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin: 30px 0 20px 0;
          }
          .po-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .po-details, .supplier-details {
            flex: 1;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 6px;
            margin: 0 10px;
          }
          .po-details h3, .supplier-details h3 {
            color: #1f2937;
            font-size: 16px;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 5px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .detail-label {
            font-weight: 600;
            color: #4b5563;
          }
          .detail-value {
            color: #1f2937;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
            background-color: white;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .items-table th {
            background-color: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
          }
          .items-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .items-table tr:hover {
            background-color: #f1f5f9;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .totals {
            margin-top: 30px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 6px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
          }
          .totals-row.total {
            border-top: 2px solid #3b82f6;
            padding-top: 10px;
            font-weight: bold;
            font-size: 18px;
            color: #1f2937;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
          .notes {
            margin-top: 30px;
            padding: 15px;
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            border-radius: 4px;
          }
          .notes h4 {
            margin: 0 0 10px 0;
            color: #92400e;
          }
          .notes p {
            margin: 0;
            color: #78350f;
          }
          @media print {
            body { background-color: white; }
            .container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <div class="company-name">${companyInfo.name}</div>
              <div class="company-details">
                ${companyInfo.address}<br>
                Tel: ${companyInfo.phone} | Email: ${companyInfo.email}
              </div>
            </div>
            <div class="po-title">PURCHASE ORDER</div>
            <div class="text-center">${getStatusBadge(purchaseOrder.status)}</div>
          </div>

          <div class="po-info">
            <div class="po-details">
              <h3>Detail Purchase Order</h3>
              <div class="detail-row">
                <span class="detail-label">Nomor PO:</span>
                <span class="detail-value">${purchaseOrder.poNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tanggal Order:</span>
                <span class="detail-value">${formatDate(purchaseOrder.orderDate)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tanggal Pengiriman:</span>
                <span class="detail-value">${formatDate(purchaseOrder.expectedDeliveryDate)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Terms:</span>
                <span class="detail-value">${purchaseOrder.paymentTerms?.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Prioritas:</span>
                <span class="detail-value">${purchaseOrder.priority?.toUpperCase()}</span>
              </div>
            </div>

            <div class="supplier-details">
              <h3>Detail Supplier</h3>
              <div class="detail-row">
                <span class="detail-label">Nama:</span>
                <span class="detail-value">${purchaseOrder.supplier?.name || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Kode:</span>
                <span class="detail-value">${purchaseOrder.supplier?.code || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${purchaseOrder.supplier?.email || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Telepon:</span>
                <span class="detail-value">${purchaseOrder.supplier?.phone || '-'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Alamat:</span>
                <span class="detail-value">${purchaseOrder.supplier?.address || '-'}</span>
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;">No</th>
                <th style="width: 15%;">SKU</th>
                <th style="width: 30%;">Nama Produk</th>
                <th style="width: 10%;">Unit</th>
                <th style="width: 10%;" class="text-center">Qty</th>
                <th style="width: 15%;" class="text-right">Harga Satuan</th>
                <th style="width: 15%;" class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseOrder.items?.map((item, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${item.sku}</td>
                  <td>
                    <strong>${item.productName}</strong>
                    ${item.description ? `<br><small style="color: #6b7280;">${item.description}</small>` : ''}
                  </td>
                  <td>${item.unit || 'pcs'}</td>
                  <td class="text-center">${item.orderedQuantity}</td>
                  <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                  <td class="text-right">${formatCurrency(item.finalPrice)}</td>
                </tr>
              `).join('') || '<tr><td colspan="7" class="text-center">Tidak ada item</td></tr>'}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(purchaseOrder.subtotalAmount)}</span>
            </div>
            ${purchaseOrder.discountAmount > 0 ? `
              <div class="totals-row">
                <span>Diskon:</span>
                <span>-${formatCurrency(purchaseOrder.discountAmount)}</span>
              </div>
            ` : ''}
            ${purchaseOrder.taxAmount > 0 ? `
              <div class="totals-row">
                <span>Pajak (${purchaseOrder.taxRate}%):</span>
                <span>${formatCurrency(purchaseOrder.taxAmount)}</span>
              </div>
            ` : ''}
            ${purchaseOrder.shippingAmount > 0 ? `
              <div class="totals-row">
                <span>Biaya Pengiriman:</span>
                <span>${formatCurrency(purchaseOrder.shippingAmount)}</span>
              </div>
            ` : ''}
            <div class="totals-row total">
              <span>TOTAL:</span>
              <span>${formatCurrency(purchaseOrder.totalAmount)}</span>
            </div>
          </div>

          ${purchaseOrder.notes || purchaseOrder.supplierInstructions ? `
            <div class="notes">
              <h4>Catatan & Instruksi</h4>
              ${purchaseOrder.notes ? `<p><strong>Catatan:</strong> ${purchaseOrder.notes}</p>` : ''}
              ${purchaseOrder.supplierInstructions ? `<p><strong>Instruksi untuk Supplier:</strong> ${purchaseOrder.supplierInstructions}</p>` : ''}
            </div>
          ` : ''}

          <div class="footer">
            <p>Purchase Order ini dibuat secara otomatis oleh sistem StokCerdas</p>
            <p>Dicetak pada: ${formatDate(new Date())}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async savePdfFile(pdfBuffer: Buffer, poNumber: string): Promise<string> {
    const uploadsDir = this.configService.get('UPLOADS_DIR', './uploads');
    const poDir = path.join(uploadsDir, 'purchase-orders');

    // Ensure directory exists
    if (!fs.existsSync(poDir)) {
      fs.mkdirSync(poDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${poNumber}-${timestamp}.pdf`;
    const filePath = path.join(poDir, filename);

    // Save file
    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }

  async deletePdfFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`PDF file deleted: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete PDF file: ${filePath}`, error.stack);
    }
  }
}