import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import * as puppeteer from 'puppeteer';
import * as csv from 'fast-csv';
import * as nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';
import { Readable } from 'stream';

import { ReportFormat } from '../dto/report-query.dto';
import {
  InventoryValuationResponseDto,
  StockMovementResponseDto,
  LowStockResponseDto,
  ProductPerformanceResponseDto,
  InventoryValuationItemDto,
  StockMovementItemDto,
  LowStockItemDto,
  ProductPerformanceItemDto,
} from '../dto/report-response.dto';

export interface ExportOptions {
  format: ReportFormat;
  filename?: string;
  email?: string;
  subject?: string;
  tenantName?: string;
}

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);
  private emailTransporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    try {
      this.emailTransporter = createTransport({
        host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASSWORD'),
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } catch (error) {
      this.logger.warn(
        'Email configuration not available. Email export will be disabled.',
      );
    }
  }

  /**
   * Export Inventory Valuation Report
   */
  async exportInventoryValuationReport(
    data: InventoryValuationResponseDto,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    const reportTitle = 'Laporan Valuasi Inventori';
    const filename =
      options.filename ||
      `inventory-valuation-${new Date().toISOString().split('T')[0]}`;

    switch (options.format) {
      case ReportFormat.CSV:
        return this.exportInventoryValuationToCsv(data, filename);
      case ReportFormat.EXCEL:
        return this.exportInventoryValuationToExcel(data, filename);
      case ReportFormat.PDF:
        return this.exportInventoryValuationToPdf(data, reportTitle, filename);
      default:
        throw new BadRequestException(
          `Unsupported export format: ${options.format}`,
        );
    }
  }

  /**
   * Export Stock Movement Report
   */
  async exportStockMovementReport(
    data: StockMovementResponseDto,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    const reportTitle = 'Laporan Pergerakan Stok';
    const filename =
      options.filename ||
      `stock-movement-${new Date().toISOString().split('T')[0]}`;

    switch (options.format) {
      case ReportFormat.CSV:
        return this.exportStockMovementToCsv(data, filename);
      case ReportFormat.EXCEL:
        return this.exportStockMovementToExcel(data, filename);
      case ReportFormat.PDF:
        return this.exportStockMovementToPdf(data, reportTitle, filename);
      default:
        throw new BadRequestException(
          `Unsupported export format: ${options.format}`,
        );
    }
  }

  /**
   * Export Low Stock Report
   */
  async exportLowStockReport(
    data: LowStockResponseDto,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    const reportTitle = 'Laporan Stok Rendah';
    const filename =
      options.filename || `low-stock-${new Date().toISOString().split('T')[0]}`;

    switch (options.format) {
      case ReportFormat.CSV:
        return this.exportLowStockToCsv(data, filename);
      case ReportFormat.EXCEL:
        return this.exportLowStockToExcel(data, filename);
      case ReportFormat.PDF:
        return this.exportLowStockToPdf(data, reportTitle, filename);
      default:
        throw new BadRequestException(
          `Unsupported export format: ${options.format}`,
        );
    }
  }

  /**
   * Export Product Performance Report
   */
  async exportProductPerformanceReport(
    data: ProductPerformanceResponseDto,
    options: ExportOptions,
  ): Promise<Buffer | string> {
    const reportTitle = 'Laporan Performa Produk';
    const filename =
      options.filename ||
      `product-performance-${new Date().toISOString().split('T')[0]}`;

    switch (options.format) {
      case ReportFormat.CSV:
        return this.exportProductPerformanceToCsv(data, filename);
      case ReportFormat.EXCEL:
        return this.exportProductPerformanceToExcel(data, filename);
      case ReportFormat.PDF:
        return this.exportProductPerformanceToPdf(data, reportTitle, filename);
      default:
        throw new BadRequestException(
          `Unsupported export format: ${options.format}`,
        );
    }
  }

  /**
   * Send report via email
   */
  async sendReportByEmail(
    reportBuffer: Buffer,
    options: ExportOptions,
    reportType: string,
  ): Promise<boolean> {
    if (!this.emailTransporter) {
      throw new BadRequestException('Email service is not configured');
    }

    if (!options.email) {
      throw new BadRequestException('Email address is required');
    }

    try {
      const fileExtension = this.getFileExtension(options.format);
      const filename = `${
        options.filename || reportType
      }-${Date.now()}.${fileExtension}`;

      const mailOptions = {
        from: this.configService.get('SMTP_FROM', 'noreply@stokcerdas.com'),
        to: options.email,
        subject:
          options.subject ||
          `Laporan ${reportType} - ${options.tenantName || 'StokCerdas'}`,
        html: this.generateEmailTemplate(reportType, options.tenantName),
        attachments: [
          {
            filename,
            content: reportBuffer,
            contentType: this.getContentType(options.format),
          },
        ],
      };

      await this.emailTransporter.sendMail(mailOptions);
      this.logger.log(`Report sent successfully to ${options.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to send report via email');
    }
  }

  // Private methods for each export format

  private async exportInventoryValuationToCsv(
    data: InventoryValuationResponseDto,
    filename: string,
  ): Promise<string> {
    const csvData = data.data.map(item => ({
      SKU: item.sku,
      'Nama Produk': item.productName,
      Kategori: item.category || '',
      Lokasi: item.locationName,
      'Qty Tersedia': item.quantityOnHand,
      'Qty Available': item.quantityAvailable,
      'Harga Rata-rata': this.formatCurrency(item.averageCost),
      'Harga Jual': this.formatCurrency(item.sellingPrice),
      'Nilai Total (Cost)': this.formatCurrency(item.totalCostValue),
      'Nilai Total (Jual)': this.formatCurrency(item.totalSellingValue),
      'Potensi Profit': this.formatCurrency(item.potentialProfit),
      'Terakhir Bergerak': item.lastMovementAt
        ? new Date(item.lastMovementAt).toLocaleDateString('id-ID')
        : '',
      'Hari Sejak Bergerak': item.daysSinceLastMovement || '',
    }));

    return new Promise((resolve, reject) => {
      const stream = csv.format({ headers: true });
      let csvString = '';

      stream.on('data', chunk => (csvString += chunk));
      stream.on('end', () => resolve(csvString));
      stream.on('error', reject);

      csvData.forEach(row => stream.write(row));
      stream.end();
    });
  }

  private async exportInventoryValuationToExcel(
    data: InventoryValuationResponseDto,
    filename: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Valuasi Inventori');

    // Headers
    const headers = [
      'SKU',
      'Nama Produk',
      'Kategori',
      'Lokasi',
      'Qty Tersedia',
      'Qty Available',
      'Harga Rata-rata',
      'Harga Jual',
      'Nilai Total (Cost)',
      'Nilai Total (Jual)',
      'Potensi Profit',
      'Terakhir Bergerak',
      'Hari Sejak Bergerak',
    ];

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };

    // Data rows
    data.data.forEach(item => {
      worksheet.addRow([
        item.sku,
        item.productName,
        item.category || '',
        item.locationName,
        item.quantityOnHand,
        item.quantityAvailable,
        item.averageCost,
        item.sellingPrice,
        item.totalCostValue,
        item.totalSellingValue,
        item.potentialProfit,
        item.lastMovementAt
          ? new Date(item.lastMovementAt).toLocaleDateString('id-ID')
          : '',
        item.daysSinceLastMovement || '',
      ]);
    });

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow([
      'RINGKASAN:',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow(['Total Items:', data.summary.totalItems]);
    worksheet.addRow([
      'Total Nilai Cost:',
      this.formatCurrency(data.summary.totalCostValue),
    ]);
    worksheet.addRow([
      'Total Nilai Jual:',
      this.formatCurrency(data.summary.totalSellingValue),
    ]);
    worksheet.addRow([
      'Total Potensi Profit:',
      this.formatCurrency(data.summary.totalPotentialProfit),
    ]);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async exportInventoryValuationToPdf(
    data: InventoryValuationResponseDto,
    title: string,
    filename: string,
  ): Promise<Buffer> {
    const htmlContent = this.generateInventoryValuationHtml(data, title);
    return this.generatePdfFromHtml(htmlContent);
  }

  private async exportStockMovementToCsv(
    data: StockMovementResponseDto,
    filename: string,
  ): Promise<string> {
    const csvData = data.data.map(item => ({
      Tanggal: new Date(item.transactionDate).toLocaleDateString('id-ID'),
      SKU: item.sku,
      'Nama Produk': item.productName,
      Lokasi: item.locationName,
      'Jenis Transaksi': item.transactionType,
      Qty: item.quantity,
      'Qty Sebelum': item.quantityBefore,
      'Qty Sesudah': item.quantityAfter,
      'Biaya Unit': item.unitCost ? this.formatCurrency(item.unitCost) : '',
      'Total Biaya': item.totalCost ? this.formatCurrency(item.totalCost) : '',
      Alasan: item.reason || '',
      Referensi: item.referenceNumber || '',
      'Dibuat Oleh': item.createdBy,
    }));

    return new Promise((resolve, reject) => {
      const stream = csv.format({ headers: true });
      let csvString = '';

      stream.on('data', chunk => (csvString += chunk));
      stream.on('end', () => resolve(csvString));
      stream.on('error', reject);

      csvData.forEach(row => stream.write(row));
      stream.end();
    });
  }

  private async exportStockMovementToExcel(
    data: StockMovementResponseDto,
    filename: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pergerakan Stok');

    // Headers
    const headers = [
      'Tanggal',
      'SKU',
      'Nama Produk',
      'Lokasi',
      'Jenis Transaksi',
      'Qty',
      'Qty Sebelum',
      'Qty Sesudah',
      'Biaya Unit',
      'Total Biaya',
      'Alasan',
      'Referensi',
      'Dibuat Oleh',
    ];

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };

    // Data rows
    data.data.forEach(item => {
      worksheet.addRow([
        new Date(item.transactionDate).toLocaleDateString('id-ID'),
        item.sku,
        item.productName,
        item.locationName,
        item.transactionType,
        item.quantity,
        item.quantityBefore,
        item.quantityAfter,
        item.unitCost || '',
        item.totalCost || '',
        item.reason || '',
        item.referenceNumber || '',
        item.createdBy,
      ]);
    });

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow([
      'RINGKASAN:',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow(['Total Pergerakan:', data.summary.totalMovements]);
    worksheet.addRow([
      'Penerimaan:',
      `${data.summary.receipts.count} transaksi, ${data.summary.receipts.totalQuantity} qty`,
    ]);
    worksheet.addRow([
      'Pengeluaran:',
      `${data.summary.issues.count} transaksi, ${data.summary.issues.totalQuantity} qty`,
    ]);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async exportStockMovementToPdf(
    data: StockMovementResponseDto,
    title: string,
    filename: string,
  ): Promise<Buffer> {
    const htmlContent = this.generateStockMovementHtml(data, title);
    return this.generatePdfFromHtml(htmlContent);
  }

  private async exportLowStockToCsv(
    data: LowStockResponseDto,
    filename: string,
  ): Promise<string> {
    const csvData = data.data.map(item => ({
      SKU: item.sku,
      'Nama Produk': item.productName,
      Kategori: item.category || '',
      Lokasi: item.locationName,
      'Qty Available': item.quantityAvailable,
      'Reorder Point': item.reorderPoint,
      'Reorder Qty': item.reorderQuantity,
      'Max Stock': item.maxStock || '',
      'Rata-rata Harian': item.averageDailySales || '',
      'Hari Tersisa': item.daysOfStockRemaining || '',
      Status: item.stockStatus,
      'Saran Reorder': item.suggestedReorderQuantity,
      'Terakhir Terjual': item.lastSaleDate
        ? new Date(item.lastSaleDate).toLocaleDateString('id-ID')
        : '',
      'Hari Sejak Terjual': item.daysSinceLastSale || '',
    }));

    return new Promise((resolve, reject) => {
      const stream = csv.format({ headers: true });
      let csvString = '';

      stream.on('data', chunk => (csvString += chunk));
      stream.on('end', () => resolve(csvString));
      stream.on('error', reject);

      csvData.forEach(row => stream.write(row));
      stream.end();
    });
  }

  private async exportLowStockToExcel(
    data: LowStockResponseDto,
    filename: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stok Rendah');

    // Headers with colors based on status
    const headers = [
      'SKU',
      'Nama Produk',
      'Kategori',
      'Lokasi',
      'Qty Available',
      'Reorder Point',
      'Reorder Qty',
      'Max Stock',
      'Rata-rata Harian',
      'Hari Tersisa',
      'Status',
      'Saran Reorder',
      'Terakhir Terjual',
      'Hari Sejak Terjual',
    ];

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };

    // Data rows with conditional formatting
    data.data.forEach((item, index) => {
      const rowIndex = index + 2;
      const row = worksheet.addRow([
        item.sku,
        item.productName,
        item.category || '',
        item.locationName,
        item.quantityAvailable,
        item.reorderPoint,
        item.reorderQuantity,
        item.maxStock || '',
        item.averageDailySales || '',
        item.daysOfStockRemaining || '',
        item.stockStatus,
        item.suggestedReorderQuantity,
        item.lastSaleDate
          ? new Date(item.lastSaleDate).toLocaleDateString('id-ID')
          : '',
        item.daysSinceLastSale || '',
      ]);

      // Color code based on stock status
      const statusColor = this.getStatusColor(item.stockStatus);
      if (statusColor) {
        row.getCell(11).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusColor },
        };
      }
    });

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow([
      'RINGKASAN:',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow(['Total Items:', data.summary.totalItems]);
    worksheet.addRow(['Out of Stock:', data.summary.outOfStock]);
    worksheet.addRow(['Critical:', data.summary.critical]);
    worksheet.addRow(['Low:', data.summary.low]);
    worksheet.addRow(['Reorder Needed:', data.summary.reorderNeeded]);
    worksheet.addRow([
      'Total Nilai Reorder:',
      this.formatCurrency(data.summary.totalReorderValue),
    ]);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async exportLowStockToPdf(
    data: LowStockResponseDto,
    title: string,
    filename: string,
  ): Promise<Buffer> {
    const htmlContent = this.generateLowStockHtml(data, title);
    return this.generatePdfFromHtml(htmlContent);
  }

  private async exportProductPerformanceToCsv(
    data: ProductPerformanceResponseDto,
    filename: string,
  ): Promise<string> {
    const csvData = data.data.map(item => ({
      Peringkat: item.performanceRank || '',
      SKU: item.sku,
      'Nama Produk': item.productName,
      Kategori: item.category || '',
      'Total Terjual': item.totalQuantitySold,
      'Nilai Penjualan': this.formatCurrency(item.totalSalesValue),
      'Total Pembelian': item.totalQuantityReceived,
      'Biaya Pembelian': this.formatCurrency(item.totalPurchaseCost),
      'Gross Profit': this.formatCurrency(item.grossProfit),
      'Margin (%)': `${item.grossProfitMargin.toFixed(2)}%`,
      'Jumlah Transaksi': item.transactionCount,
      'Stok Saat Ini': item.currentStockLevel,
      'Inventory Turnover': item.inventoryTurnover.toFixed(2),
      'Hari di Inventori': item.daysInInventory.toFixed(0),
      'Harga Rata-rata': this.formatCurrency(item.averageSalePrice),
      'Qty Rata-rata': item.averageSaleQuantity.toFixed(2),
      'Kategori Performa': item.performanceCategory,
      'Pertama Terjual': item.firstSaleDate
        ? new Date(item.firstSaleDate).toLocaleDateString('id-ID')
        : '',
      'Terakhir Terjual': item.lastSaleDate
        ? new Date(item.lastSaleDate).toLocaleDateString('id-ID')
        : '',
    }));

    return new Promise((resolve, reject) => {
      const stream = csv.format({ headers: true });
      let csvString = '';

      stream.on('data', chunk => (csvString += chunk));
      stream.on('end', () => resolve(csvString));
      stream.on('error', reject);

      csvData.forEach(row => stream.write(row));
      stream.end();
    });
  }

  private async exportProductPerformanceToExcel(
    data: ProductPerformanceResponseDto,
    filename: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Performa Produk');

    // Headers
    const headers = [
      'Peringkat',
      'SKU',
      'Nama Produk',
      'Kategori',
      'Total Terjual',
      'Nilai Penjualan',
      'Total Pembelian',
      'Biaya Pembelian',
      'Gross Profit',
      'Margin (%)',
      'Jumlah Transaksi',
      'Stok Saat Ini',
      'Inventory Turnover',
      'Hari di Inventori',
      'Harga Rata-rata',
      'Qty Rata-rata',
      'Kategori Performa',
    ];

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };

    // Data rows
    data.data.forEach((item, index) => {
      const row = worksheet.addRow([
        item.performanceRank || index + 1,
        item.sku,
        item.productName,
        item.category || '',
        item.totalQuantitySold,
        item.totalSalesValue,
        item.totalQuantityReceived,
        item.totalPurchaseCost,
        item.grossProfit,
        `${item.grossProfitMargin.toFixed(2)}%`,
        item.transactionCount,
        item.currentStockLevel,
        item.inventoryTurnover.toFixed(2),
        item.daysInInventory.toFixed(0),
        item.averageSalePrice,
        item.averageSaleQuantity.toFixed(2),
        item.performanceCategory,
      ]);

      // Color code based on performance category
      const perfColor = this.getPerformanceColor(item.performanceCategory);
      if (perfColor) {
        row.getCell(17).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: perfColor },
        };
      }
    });

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow([
      'RINGKASAN:',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow(['Total Produk:', data.summary.totalProducts]);
    worksheet.addRow(['High Performers:', data.summary.highPerformers]);
    worksheet.addRow(['Medium Performers:', data.summary.mediumPerformers]);
    worksheet.addRow(['Low Performers:', data.summary.lowPerformers]);
    worksheet.addRow(['Slow Moving:', data.summary.slowMoving]);
    worksheet.addRow([
      'Total Nilai Penjualan:',
      this.formatCurrency(data.summary.totalSalesValue),
    ]);
    worksheet.addRow([
      'Total Gross Profit:',
      this.formatCurrency(data.summary.totalGrossProfit),
    ]);
    worksheet.addRow([
      'Rata-rata Margin:',
      `${data.summary.averageGrossProfitMargin.toFixed(2)}%`,
    ]);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async exportProductPerformanceToPdf(
    data: ProductPerformanceResponseDto,
    title: string,
    filename: string,
  ): Promise<Buffer> {
    const htmlContent = this.generateProductPerformanceHtml(data, title);
    return this.generatePdfFromHtml(htmlContent);
  }

  // Helper methods

  private async generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
    let browser: puppeteer.Browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        printBackground: true,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(`PDF generation error: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to generate PDF');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private generateInventoryValuationHtml(
    data: InventoryValuationResponseDto,
    title: string,
  ): string {
    const rows = data.data
      .map(
        item => `
      <tr>
        <td>${item.sku}</td>
        <td>${item.productName}</td>
        <td>${item.category || ''}</td>
        <td>${item.locationName}</td>
        <td class="number">${item.quantityOnHand}</td>
        <td class="number">${item.quantityAvailable}</td>
        <td class="currency">${this.formatCurrency(item.averageCost)}</td>
        <td class="currency">${this.formatCurrency(item.sellingPrice)}</td>
        <td class="currency">${this.formatCurrency(item.totalCostValue)}</td>
        <td class="currency">${this.formatCurrency(item.totalSellingValue)}</td>
        <td class="currency">${this.formatCurrency(item.potentialProfit)}</td>
      </tr>
    `,
      )
      .join('');

    return this.generatePdfTemplate(
      title,
      `
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Nama Produk</th>
            <th>Kategori</th>
            <th>Lokasi</th>
            <th>Qty Tersedia</th>
            <th>Qty Available</th>
            <th>Harga Rata-rata</th>
            <th>Harga Jual</th>
            <th>Nilai Total (Cost)</th>
            <th>Nilai Total (Jual)</th>
            <th>Potensi Profit</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="summary">
        <h3>Ringkasan</h3>
        <p>Total Items: ${data.summary.totalItems}</p>
        <p>Total Nilai Cost: ${this.formatCurrency(
          data.summary.totalCostValue,
        )}</p>
        <p>Total Nilai Jual: ${this.formatCurrency(
          data.summary.totalSellingValue,
        )}</p>
        <p>Total Potensi Profit: ${this.formatCurrency(
          data.summary.totalPotentialProfit,
        )}</p>
      </div>
    `,
    );
  }

  private generateStockMovementHtml(
    data: StockMovementResponseDto,
    title: string,
  ): string {
    const rows = data.data
      .slice(0, 50)
      .map(
        item => `
      <tr>
        <td>${new Date(item.transactionDate).toLocaleDateString('id-ID')}</td>
        <td>${item.sku}</td>
        <td>${item.productName}</td>
        <td>${item.locationName}</td>
        <td>${item.transactionType}</td>
        <td class="number">${item.quantity}</td>
        <td class="number">${item.quantityBefore}</td>
        <td class="number">${item.quantityAfter}</td>
        <td>${item.reason || ''}</td>
      </tr>
    `,
      )
      .join('');

    return this.generatePdfTemplate(
      title,
      `
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>SKU</th>
            <th>Nama Produk</th>
            <th>Lokasi</th>
            <th>Jenis Transaksi</th>
            <th>Qty</th>
            <th>Qty Sebelum</th>
            <th>Qty Sesudah</th>
            <th>Alasan</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${
        data.data.length > 50
          ? '<p><em>Menampilkan 50 item pertama. Download Excel/CSV untuk data lengkap.</em></p>'
          : ''
      }
      <div class="summary">
        <h3>Ringkasan</h3>
        <p>Total Pergerakan: ${data.summary.totalMovements}</p>
        <p>Penerimaan: ${data.summary.receipts.count} transaksi, ${
        data.summary.receipts.totalQuantity
      } qty</p>
        <p>Pengeluaran: ${data.summary.issues.count} transaksi, ${
        data.summary.issues.totalQuantity
      } qty</p>
      </div>
    `,
    );
  }

  private generateLowStockHtml(
    data: LowStockResponseDto,
    title: string,
  ): string {
    const rows = data.data
      .map(
        item => `
      <tr class="${item.stockStatus}">
        <td>${item.sku}</td>
        <td>${item.productName}</td>
        <td>${item.locationName}</td>
        <td class="number">${item.quantityAvailable}</td>
        <td class="number">${item.reorderPoint}</td>
        <td class="status">${item.stockStatus}</td>
        <td class="number">${item.suggestedReorderQuantity}</td>
        <td>${item.daysOfStockRemaining || ''}</td>
      </tr>
    `,
      )
      .join('');

    return this.generatePdfTemplate(
      title,
      `
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Nama Produk</th>
            <th>Lokasi</th>
            <th>Qty Available</th>
            <th>Reorder Point</th>
            <th>Status</th>
            <th>Saran Reorder</th>
            <th>Hari Tersisa</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="summary">
        <h3>Ringkasan</h3>
        <p>Total Items: ${data.summary.totalItems}</p>
        <p class="out-of-stock">Out of Stock: ${data.summary.outOfStock}</p>
        <p class="critical">Critical: ${data.summary.critical}</p>
        <p class="low">Low: ${data.summary.low}</p>
        <p class="reorder-needed">Reorder Needed: ${
          data.summary.reorderNeeded
        }</p>
        <p>Total Nilai Reorder: ${this.formatCurrency(
          data.summary.totalReorderValue,
        )}</p>
      </div>
    `,
    );
  }

  private generateProductPerformanceHtml(
    data: ProductPerformanceResponseDto,
    title: string,
  ): string {
    const rows = data.data
      .slice(0, 30)
      .map(
        item => `
      <tr class="${item.performanceCategory}">
        <td>${item.performanceRank || ''}</td>
        <td>${item.sku}</td>
        <td>${item.productName}</td>
        <td class="currency">${this.formatCurrency(item.totalSalesValue)}</td>
        <td class="number">${item.totalQuantitySold}</td>
        <td class="currency">${this.formatCurrency(item.grossProfit)}</td>
        <td class="percentage">${item.grossProfitMargin.toFixed(1)}%</td>
        <td class="number">${item.inventoryTurnover.toFixed(1)}</td>
        <td class="category">${item.performanceCategory}</td>
      </tr>
    `,
      )
      .join('');

    return this.generatePdfTemplate(
      title,
      `
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>SKU</th>
            <th>Nama Produk</th>
            <th>Nilai Penjualan</th>
            <th>Total Terjual</th>
            <th>Gross Profit</th>
            <th>Margin</th>
            <th>Turnover</th>
            <th>Kategori</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${
        data.data.length > 30
          ? '<p><em>Menampilkan 30 produk teratas. Download Excel/CSV untuk data lengkap.</em></p>'
          : ''
      }
      <div class="summary">
        <h3>Ringkasan</h3>
        <p>Total Produk: ${data.summary.totalProducts}</p>
        <p class="high">High Performers: ${data.summary.highPerformers}</p>
        <p class="medium">Medium Performers: ${
          data.summary.mediumPerformers
        }</p>
        <p class="low">Low Performers: ${data.summary.lowPerformers}</p>
        <p class="slow_moving">Slow Moving: ${data.summary.slowMoving}</p>
        <p>Rata-rata Margin: ${data.summary.averageGrossProfitMargin.toFixed(
          1,
        )}%</p>
      </div>
    `,
    );
  }

  private generatePdfTemplate(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 10px;
              line-height: 1.4;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #0066cc;
              padding-bottom: 15px;
            }
            .header h1 {
              color: #0066cc;
              margin: 0;
              font-size: 20px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 9px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            .number, .currency, .percentage {
              text-align: right;
            }
            .currency::before {
              content: 'Rp ';
            }
            .summary {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 5px;
              margin-top: 20px;
            }
            .summary h3 {
              margin-top: 0;
              color: #0066cc;
            }
            .out_of_stock, .out-of-stock { background-color: #ffebee; }
            .critical { background-color: #fff3e0; }
            .low { background-color: #f3e5f5; }
            .reorder_needed, .reorder-needed { background-color: #e8f5e8; }
            .high { background-color: #e8f5e8; }
            .medium { background-color: #fff3e0; }
            .low_performers { background-color: #ffebee; }
            .slow_moving { background-color: #f5f5f5; }
            .status {
              font-weight: bold;
              text-transform: uppercase;
            }
            .category {
              font-weight: bold;
              text-transform: capitalize;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>StokCerdas - Laporan Inventori</p>
            <p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
          </div>
          ${content}
        </body>
      </html>
    `;
  }

  private generateEmailTemplate(
    reportType: string,
    tenantName?: string,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #0066cc; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">StokCerdas</h1>
          <p style="margin: 10px 0 0 0;">Laporan Inventori</p>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h2>Halo${tenantName ? ` ${tenantName}` : ''},</h2>
          <p>Laporan <strong>${reportType}</strong> telah berhasil dibuat dan dilampirkan dalam email ini.</p>
          <p>Laporan ini dibuat pada: <strong>${new Date().toLocaleDateString(
            'id-ID',
          )}</strong></p>
          <p>Silakan buka lampiran untuk melihat detail laporan Anda.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            Email ini dikirim secara otomatis oleh sistem StokCerdas.<br>
            Jika Anda memiliki pertanyaan, silakan hubungi tim support kami.
          </p>
        </div>
      </div>
    `;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private getFileExtension(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV:
        return 'csv';
      case ReportFormat.EXCEL:
        return 'xlsx';
      case ReportFormat.PDF:
        return 'pdf';
      default:
        return 'json';
    }
  }

  private getContentType(format: ReportFormat): string {
    switch (format) {
      case ReportFormat.CSV:
        return 'text/csv';
      case ReportFormat.EXCEL:
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ReportFormat.PDF:
        return 'application/pdf';
      default:
        return 'application/json';
    }
  }

  private getStatusColor(status: string): string | null {
    switch (status) {
      case 'out_of_stock':
        return 'FFCDD2';
      case 'critical':
        return 'FFE0B2';
      case 'low':
        return 'F3E5F5';
      case 'reorder_needed':
        return 'C8E6C9';
      default:
        return null;
    }
  }

  private getPerformanceColor(category: string): string | null {
    switch (category) {
      case 'high':
        return 'C8E6C9';
      case 'medium':
        return 'FFE0B2';
      case 'low':
        return 'FFCDD2';
      case 'slow_moving':
        return 'F5F5F5';
      default:
        return null;
    }
  }
}
