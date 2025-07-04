import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';
import * as path from 'path';

import { PurchaseOrder } from '../entities/purchase-order.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrderPdfService } from './purchase-order-pdf.service';

export interface PurchaseOrderEmailData {
  tenantId: string;
  purchaseOrder: PurchaseOrder;
  recipients?: string[];
  emailType:
    | 'creation'
    | 'approval'
    | 'rejection'
    | 'sent_to_supplier'
    | 'status_update';
  customSubject?: string;
  customMessage?: string;
  additionalData?: Record<string, any>;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

@Injectable()
export class PurchaseOrderEmailService {
  private readonly logger = new Logger(PurchaseOrderEmailService.name);
  private emailTransporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly pdfService: PurchaseOrderPdfService,
  ) {
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

      this.logger.log('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error.stack);
    }
  }

  /**
   * Send purchase order email notification
   */
  async sendPurchaseOrderEmail(data: PurchaseOrderEmailData): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        this.logger.warn('Email transporter not available');
        return false;
      }

      const template = await this.generateEmailTemplate(data);
      const recipients = await this.getRecipients(data);

      if (!recipients || recipients.length === 0) {
        this.logger.warn(
          `No recipients found for PO ${data.purchaseOrder.poNumber}`,
        );
        return true;
      }

      const attachments = [];

      // Generate PDF attachment for supplier emails
      if (data.emailType === 'sent_to_supplier') {
        try {
          const pdfPath = await this.pdfService.generatePdf(data.purchaseOrder);
          attachments.push({
            filename: `PO-${data.purchaseOrder.poNumber}.pdf`,
            path: pdfPath,
          });
        } catch (error) {
          this.logger.error(
            `Failed to generate PDF for PO ${data.purchaseOrder.poNumber}`,
            error.stack,
          );
        }
      }

      // Send email
      const mailOptions = {
        from: {
          name: 'StokCerdas System',
          address: this.configService.get(
            'SMTP_FROM',
            'noreply@stokcerdas.com',
          ),
        },
        to: recipients,
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent,
        attachments,
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully for PO ${
          data.purchaseOrder.poNumber
        } to ${recipients.join(', ')}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email for PO ${data.purchaseOrder.poNumber}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Generate email template based on type
   */
  private async generateEmailTemplate(
    data: PurchaseOrderEmailData,
  ): Promise<EmailTemplate> {
    const po = data.purchaseOrder;
    const companyName = 'StokCerdas';

    switch (data.emailType) {
      case 'creation':
        return this.getCreationTemplate(po, companyName);

      case 'approval':
        return this.getApprovalTemplate(po, companyName, data.additionalData);

      case 'rejection':
        return this.getRejectionTemplate(po, companyName, data.additionalData);

      case 'sent_to_supplier':
        return this.getSupplierTemplate(po, companyName);

      case 'status_update':
        return this.getStatusUpdateTemplate(
          po,
          companyName,
          data.additionalData,
        );

      default:
        return this.getDefaultTemplate(po, companyName);
    }
  }

  private getCreationTemplate(
    po: PurchaseOrder,
    companyName: string,
  ): EmailTemplate {
    const subject = `Purchase Order Baru - ${po.poNumber}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Purchase Order Baru</h1>
          <p style="margin: 10px 0 0 0;">Sistem ${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h2 style="color: #1f2937;">Detail Purchase Order</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Nomor PO:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.poNumber
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Supplier:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.supplier?.name || '-'
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Status:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.getStatusText(
                po.status,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total Nilai:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(
                po.totalAmount,
                po.currency,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Tanggal Order:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatDate(
                po.orderDate,
              )}</td>
            </tr>
          </table>

          ${
            po.requiresApproval
              ? `
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Perhatian:</strong> Purchase Order ini memerlukan approval sebelum dapat dikirim ke supplier.
              </p>
            </div>
          `
              : ''
          }
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Email ini dikirim secara otomatis oleh sistem ${companyName}. 
            Silakan login ke dashboard untuk melihat detail lengkap.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Purchase Order Baru - ${po.poNumber}

Nomor PO: ${po.poNumber}
Supplier: ${po.supplier?.name || '-'}
Status: ${this.getStatusText(po.status)}
Total Nilai: ${this.formatCurrency(po.totalAmount, po.currency)}
Tanggal Order: ${this.formatDate(po.orderDate)}

${
  po.requiresApproval
    ? 'PERHATIAN: Purchase Order ini memerlukan approval sebelum dapat dikirim ke supplier.'
    : ''
}

Email ini dikirim secara otomatis oleh sistem ${companyName}.
    `;

    return { subject, htmlContent, textContent };
  }

  private getApprovalTemplate(
    po: PurchaseOrder,
    companyName: string,
    additionalData?: any,
  ): EmailTemplate {
    const subject = `Purchase Order Disetujui - ${po.poNumber}`;
    const approverName = additionalData?.approverName || 'System';
    const comments = additionalData?.comments || '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Purchase Order Disetujui</h1>
          <p style="margin: 10px 0 0 0;">Sistem ${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #065f46;">
              <strong>✅ Kabar Baik!</strong> Purchase Order ${
                po.poNumber
              } telah disetujui dan dapat dikirim ke supplier.
            </p>
          </div>
          
          <h2 style="color: #1f2937;">Detail Purchase Order</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Nomor PO:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.poNumber
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Supplier:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.supplier?.name || '-'
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Disetujui oleh:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${approverName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Tanggal Approval:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatDate(
                po.approvedAt,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total Nilai:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(
                po.totalAmount,
                po.currency,
              )}</td>
            </tr>
          </table>

          ${
            comments
              ? `
            <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">Komentar Approval:</h3>
              <p style="margin: 0; color: #374151;">${comments}</p>
            </div>
          `
              : ''
          }
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Purchase Order ini sekarang dapat dikirim ke supplier. 
            Silakan login ke dashboard untuk melakukan pengiriman.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Purchase Order Disetujui - ${po.poNumber}

Purchase Order ${po.poNumber} telah disetujui dan dapat dikirim ke supplier.

Nomor PO: ${po.poNumber}
Supplier: ${po.supplier?.name || '-'}
Disetujui oleh: ${approverName}
Tanggal Approval: ${this.formatDate(po.approvedAt)}
Total Nilai: ${this.formatCurrency(po.totalAmount, po.currency)}

${comments ? `Komentar Approval: ${comments}` : ''}

Purchase Order ini sekarang dapat dikirim ke supplier.
    `;

    return { subject, htmlContent, textContent };
  }

  private getRejectionTemplate(
    po: PurchaseOrder,
    companyName: string,
    additionalData?: any,
  ): EmailTemplate {
    const subject = `Purchase Order Ditolak - ${po.poNumber}`;
    const rejectorName = additionalData?.rejectorName || 'System';
    const reason = additionalData?.reason || 'Tidak ada alasan yang diberikan';
    const comments = additionalData?.comments || '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Purchase Order Ditolak</h1>
          <p style="margin: 10px 0 0 0;">Sistem ${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #991b1b;">
              <strong>❌ Purchase Order Ditolak</strong> Purchase Order ${
                po.poNumber
              } telah ditolak dan perlu diperbaiki.
            </p>
          </div>
          
          <h2 style="color: #1f2937;">Detail Purchase Order</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Nomor PO:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.poNumber
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Supplier:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.supplier?.name || '-'
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Ditolak oleh:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${rejectorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Tanggal Penolakan:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatDate(
                po.rejectedAt,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total Nilai:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(
                po.totalAmount,
                po.currency,
              )}</td>
            </tr>
          </table>

          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">Alasan Penolakan:</h3>
            <p style="margin: 0; color: #374151; font-weight: bold;">${reason}</p>
            ${
              comments
                ? `
              <h3 style="margin: 15px 0 10px 0; color: #1f2937;">Komentar Tambahan:</h3>
              <p style="margin: 0; color: #374151;">${comments}</p>
            `
                : ''
            }
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Silakan lakukan perbaikan sesuai dengan alasan penolakan di atas, 
            kemudian ajukan kembali untuk approval.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Purchase Order Ditolak - ${po.poNumber}

Purchase Order ${po.poNumber} telah ditolak dan perlu diperbaiki.

Nomor PO: ${po.poNumber}
Supplier: ${po.supplier?.name || '-'}
Ditolak oleh: ${rejectorName}
Tanggal Penolakan: ${this.formatDate(po.rejectedAt)}
Total Nilai: ${this.formatCurrency(po.totalAmount, po.currency)}

Alasan Penolakan: ${reason}
${comments ? `Komentar Tambahan: ${comments}` : ''}

Silakan lakukan perbaikan sesuai dengan alasan penolakan di atas.
    `;

    return { subject, htmlContent, textContent };
  }

  private getSupplierTemplate(
    po: PurchaseOrder,
    companyName: string,
  ): EmailTemplate {
    const subject = `Purchase Order - ${po.poNumber}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Purchase Order</h1>
          <p style="margin: 10px 0 0 0;">${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <p>Yth. <strong>${po.supplier?.name}</strong>,</p>
          
          <p>Kami dengan ini mengirimkan Purchase Order dengan detail sebagai berikut:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Nomor PO:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.poNumber
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Tanggal Order:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatDate(
                po.orderDate,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Tanggal Pengiriman:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatDate(
                po.expectedDeliveryDate,
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Payment Terms:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${po.paymentTerms
                ?.replace('_', ' ')
                .toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total Nilai:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>${this.formatCurrency(
                po.totalAmount,
                po.currency,
              )}</strong></td>
            </tr>
          </table>

          ${
            po.supplierInstructions
              ? `
            <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">Instruksi Khusus:</h3>
              <p style="margin: 0; color: #374151;">${po.supplierInstructions}</p>
            </div>
          `
              : ''
          }

          <p>Detail lengkap item yang dipesan terdapat dalam file PDF terlampir.</p>
          
          <p>Mohon konfirmasi penerimaan PO ini dan informasikan estimasi waktu pengiriman.</p>
          
          <p>Terima kasih atas kerjasamanya.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Hormat kami,<br>
              <strong>${companyName}</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
Purchase Order - ${po.poNumber}

Yth. ${po.supplier?.name},

Kami dengan ini mengirimkan Purchase Order dengan detail sebagai berikut:

Nomor PO: ${po.poNumber}
Tanggal Order: ${this.formatDate(po.orderDate)}
Tanggal Pengiriman: ${this.formatDate(po.expectedDeliveryDate)}
Payment Terms: ${po.paymentTerms?.replace('_', ' ').toUpperCase()}
Total Nilai: ${this.formatCurrency(po.totalAmount, po.currency)}

${po.supplierInstructions ? `Instruksi Khusus: ${po.supplierInstructions}` : ''}

Detail lengkap item yang dipesan terdapat dalam file PDF terlampir.
Mohon konfirmasi penerimaan PO ini dan informasikan estimasi waktu pengiriman.

Terima kasih atas kerjasamanya.

Hormat kami,
${companyName}
    `;

    return { subject, htmlContent, textContent };
  }

  private getStatusUpdateTemplate(
    po: PurchaseOrder,
    companyName: string,
    additionalData?: any,
  ): EmailTemplate {
    const subject = `Update Status Purchase Order - ${po.poNumber}`;
    const previousStatus = additionalData?.previousStatus || '';
    const newStatus = this.getStatusText(po.status);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #6366f1; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Update Status Purchase Order</h1>
          <p style="margin: 10px 0 0 0;">Sistem ${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h2 style="color: #1f2937;">Status Terbaru</h2>
          
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;">
              Purchase Order <strong>${po.poNumber}</strong> telah diupdate:
            </p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #1f2937;">
              ${
                previousStatus ? `${this.getStatusText(previousStatus)} → ` : ''
              }<strong>${newStatus}</strong>
            </p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Nomor PO:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.poNumber
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Supplier:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${
                po.supplier?.name || '-'
              }</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Status Saat Ini:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${newStatus}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total Nilai:</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(
                po.totalAmount,
                po.currency,
              )}</td>
            </tr>
          </table>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Silakan login ke dashboard untuk melihat detail lengkap dan tracking status.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Update Status Purchase Order - ${po.poNumber}

Purchase Order ${po.poNumber} telah diupdate:
${previousStatus ? `${this.getStatusText(previousStatus)} → ` : ''}${newStatus}

Nomor PO: ${po.poNumber}
Supplier: ${po.supplier?.name || '-'}
Status Saat Ini: ${newStatus}
Total Nilai: ${this.formatCurrency(po.totalAmount, po.currency)}

Silakan login ke dashboard untuk melihat detail lengkap.
    `;

    return { subject, htmlContent, textContent };
  }

  private getDefaultTemplate(
    po: PurchaseOrder,
    companyName: string,
  ): EmailTemplate {
    const subject = `Purchase Order Notification - ${po.poNumber}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #6b7280; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Purchase Order Notification</h1>
          <p style="margin: 10px 0 0 0;">Sistem ${companyName}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa;">
          <p>Ada notifikasi terkait Purchase Order <strong>${po.poNumber}</strong>.</p>
          
          <p>Silakan login ke dashboard untuk melihat detail lengkap.</p>
        </div>
      </div>
    `;

    const textContent = `
Purchase Order Notification - ${po.poNumber}

Ada notifikasi terkait Purchase Order ${po.poNumber}.
Silakan login ke dashboard untuk melihat detail lengkap.
    `;

    return { subject, htmlContent, textContent };
  }

  private async getRecipients(data: PurchaseOrderEmailData): Promise<string[]> {
    const recipients: string[] = [];

    // Custom recipients
    if (data.recipients && data.recipients.length > 0) {
      recipients.push(...data.recipients);
    }

    // For supplier emails, use supplier email
    if (
      data.emailType === 'sent_to_supplier' &&
      data.purchaseOrder.supplier?.email
    ) {
      recipients.push(data.purchaseOrder.supplier.email);
    }

    // For internal notifications, find relevant users
    if (data.emailType !== 'sent_to_supplier') {
      try {
        // Find users who should receive PO notifications
        // This could be based on roles, departments, or specific settings
        const notificationUsers = await this.userRepository.find({
          where: [
            // Add conditions based on your business logic
            // For example: users with purchase_orders permissions
          ],
        });

        notificationUsers.forEach(user => {
          if (user.email) {
            recipients.push(user.email);
          }
        });
      } catch (error) {
        this.logger.error('Failed to get notification users', error.stack);
      }
    }

    // Remove duplicates
    return [...new Set(recipients)];
  }

  private formatCurrency(amount: number, currency: string = 'IDR'): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  private formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  private getStatusText(status: string): string {
    const statusMap = {
      draft: 'Draft',
      pending_approval: 'Menunggu Approval',
      approved: 'Disetujui',
      rejected: 'Ditolak',
      sent_to_supplier: 'Dikirim ke Supplier',
      acknowledged: 'Dikonfirmasi Supplier',
      partially_received: 'Sebagian Diterima',
      received: 'Diterima',
      closed: 'Ditutup',
      cancelled: 'Dibatalkan',
    };

    return statusMap[status] || status;
  }
}
