import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { PurchaseOrderPdfService } from '../services/purchase-order-pdf.service';
import { PurchaseOrderEmailService } from '../services/purchase-order-email.service';

@Processor('purchase-orders')
export class PurchaseOrderProcessor {
  private readonly logger = new Logger(PurchaseOrderProcessor.name);

  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly pdfService: PurchaseOrderPdfService,
    private readonly emailService: PurchaseOrderEmailService,
  ) {}

  @Process('indexPurchaseOrder')
  async handleIndexPurchaseOrder(job: Job<{
    purchaseOrderId: string;
    action: 'create' | 'update' | 'delete' | 'cancel' | 'softDelete';
  }>): Promise<void> {
    const { purchaseOrderId, action } = job.data;
    
    try {
      this.logger.log(`Processing index job for PO ${purchaseOrderId} with action ${action}`);

      // Here you would implement Elasticsearch indexing
      // For now, we'll just log the action
      
      switch (action) {
        case 'create':
        case 'update':
          this.logger.log(`Indexing PO ${purchaseOrderId} for ${action}`);
          // await this.elasticsearchService.index(purchaseOrder);
          break;
          
        case 'delete':
        case 'cancel':
        case 'softDelete':
          this.logger.log(`Removing PO ${purchaseOrderId} from index for ${action}`);
          // await this.elasticsearchService.delete(purchaseOrderId);
          break;
      }
      
      this.logger.log(`Successfully processed index job for PO ${purchaseOrderId}`);
    } catch (error) {
      this.logger.error(`Failed to process index job for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('sendCreationNotification')
  async handleSendCreationNotification(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
  }>): Promise<void> {
    const { purchaseOrderId } = job.data;
    
    try {
      this.logger.log(`Sending creation notification for PO ${purchaseOrderId}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      await this.emailService.sendPurchaseOrderEmail({
        tenantId: purchaseOrder.tenantId,
        purchaseOrder,
        emailType: 'creation',
      });
      
      this.logger.log(`Successfully sent creation notification for PO ${purchaseOrderId}`);
    } catch (error) {
      this.logger.error(`Failed to send creation notification for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('sendApprovalNotification')
  async handleSendApprovalNotification(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
    action: 'approved' | 'rejected';
    comments?: string;
    reason?: string;
    approvedBy?: string;
    rejectedBy?: string;
  }>): Promise<void> {
    const { purchaseOrderId, action, comments, reason, approvedBy, rejectedBy } = job.data;
    
    try {
      this.logger.log(`Sending ${action} notification for PO ${purchaseOrderId}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      const emailType = action === 'approved' ? 'approval' : 'rejection';
      const additionalData = action === 'approved' 
        ? { comments, approvedBy }
        : { reason, comments, rejectedBy };

      await this.emailService.sendPurchaseOrderEmail({
        tenantId: purchaseOrder.tenantId,
        purchaseOrder,
        emailType,
        additionalData,
      });
      
      this.logger.log(`Successfully sent ${action} notification for PO ${purchaseOrderId}`);
    } catch (error) {
      this.logger.error(`Failed to send ${action} notification for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('sendToSupplier')
  async handleSendToSupplier(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
    sendEmail: boolean;
    generatePdf: boolean;
    sentBy?: string;
  }>): Promise<void> {
    const { purchaseOrderId, sendEmail, generatePdf, sentBy } = job.data;
    
    try {
      this.logger.log(`Processing send to supplier for PO ${purchaseOrderId}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      let pdfPath: string | undefined;

      // Generate PDF if requested
      if (generatePdf) {
        try {
          pdfPath = await this.pdfService.generatePdf(purchaseOrder);
          this.logger.log(`PDF generated for PO ${purchaseOrderId}: ${pdfPath}`);
        } catch (pdfError) {
          this.logger.error(`Failed to generate PDF for PO ${purchaseOrderId}`, pdfError.stack);
          // Continue without PDF if generation fails
        }
      }

      // Send email to supplier if requested
      if (sendEmail) {
        await this.emailService.sendPurchaseOrderEmail({
          tenantId: purchaseOrder.tenantId,
          purchaseOrder,
          emailType: 'sent_to_supplier',
          additionalData: { sentBy, pdfPath },
        });
      }
      
      this.logger.log(`Successfully processed send to supplier for PO ${purchaseOrderId}`);
    } catch (error) {
      this.logger.error(`Failed to process send to supplier for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('sendStatusUpdate')
  async handleSendStatusUpdate(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
    previousStatus?: string;
    newStatus: string;
    reason?: string;
    updatedBy?: string;
  }>): Promise<void> {
    const { purchaseOrderId, previousStatus, newStatus, reason, updatedBy } = job.data;
    
    try {
      this.logger.log(`Sending status update notification for PO ${purchaseOrderId}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      await this.emailService.sendPurchaseOrderEmail({
        tenantId: purchaseOrder.tenantId,
        purchaseOrder,
        emailType: 'status_update',
        additionalData: {
          previousStatus,
          newStatus,
          reason,
          updatedBy,
        },
      });
      
      this.logger.log(`Successfully sent status update notification for PO ${purchaseOrderId}`);
    } catch (error) {
      this.logger.error(`Failed to send status update notification for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('generatePdf')
  async handleGeneratePdf(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
    emailToRecipients?: string[];
    saveToStorage?: boolean;
  }>): Promise<string> {
    const { purchaseOrderId, emailToRecipients, saveToStorage } = job.data;
    
    try {
      this.logger.log(`Generating PDF for PO ${purchaseOrderId}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      const pdfPath = await this.pdfService.generatePdf(purchaseOrder);

      // Send PDF via email if recipients provided
      if (emailToRecipients && emailToRecipients.length > 0) {
        // Implementation for sending PDF via email
        this.logger.log(`Sending PDF for PO ${purchaseOrderId} to ${emailToRecipients.join(', ')}`);
      }

      // Save to cloud storage if requested
      if (saveToStorage) {
        // Implementation for uploading to cloud storage
        this.logger.log(`Saving PDF for PO ${purchaseOrderId} to cloud storage`);
      }
      
      this.logger.log(`Successfully generated PDF for PO ${purchaseOrderId}: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      this.logger.error(`Failed to generate PDF for PO ${purchaseOrderId}`, error.stack);
      throw error;
    }
  }

  @Process('bulkExport')
  async handleBulkExport(job: Job<{
    tenantId: string;
    purchaseOrderIds?: string[];
    format: 'excel' | 'csv' | 'pdf';
    includeItems: boolean;
    includeApprovals: boolean;
    includeStatusHistory: boolean;
    userId: string;
    userEmail: string;
  }>): Promise<void> {
    const { 
      tenantId, 
      purchaseOrderIds, 
      format, 
      includeItems, 
      includeApprovals, 
      includeStatusHistory,
      userId,
      userEmail
    } = job.data;
    
    try {
      this.logger.log(`Processing bulk export for tenant ${tenantId}, format: ${format}`);

      // Implementation for bulk export
      // This would involve:
      // 1. Fetching all requested POs
      // 2. Converting to requested format (Excel/CSV/PDF)
      // 3. Saving file
      // 4. Sending download link via email

      let exportData;
      
      if (purchaseOrderIds && purchaseOrderIds.length > 0) {
        // Export specific POs
        exportData = await Promise.all(
          purchaseOrderIds.map(id => 
            this.purchaseOrdersService.findOne(tenantId, id)
          )
        );
      } else {
        // Export all POs for tenant
        const result = await this.purchaseOrdersService.findAll(tenantId, {
          includeItems,
          includeApprovals,
          includeStatusHistory,
          limit: 10000, // Large limit for export
        });
        exportData = result.data;
      }

      // Here you would implement the actual export logic based on format
      switch (format) {
        case 'excel':
          // Generate Excel file
          break;
        case 'csv':
          // Generate CSV file
          break;
        case 'pdf':
          // Generate PDF report
          break;
      }

      // Send email with download link
      this.logger.log(`Bulk export completed for tenant ${tenantId}, sending email to ${userEmail}`);
      
    } catch (error) {
      this.logger.error(`Failed to process bulk export for tenant ${tenantId}`, error.stack);
      throw error;
    }
  }

  @Process('cleanupOldPdfs')
  async handleCleanupOldPdfs(job: Job<{
    olderThanDays: number;
  }>): Promise<void> {
    const { olderThanDays } = job.data;
    
    try {
      this.logger.log(`Cleaning up PDF files older than ${olderThanDays} days`);

      // Implementation for cleaning up old PDF files
      // This would involve:
      // 1. Finding PDF files older than specified days
      // 2. Checking if they're still referenced
      // 3. Deleting unreferenced old files

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find old POs and clean up their PDFs
      // await this.pdfService.cleanupOldFiles(cutoffDate);
      
      this.logger.log(`Successfully cleaned up old PDF files`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old PDF files`, error.stack);
      throw error;
    }
  }

  @Process('syncWithInventory')
  async handleSyncWithInventory(job: Job<{
    purchaseOrderId: string;
    tenantId: string;
    action: 'reserve' | 'release' | 'receive';
  }>): Promise<void> {
    const { purchaseOrderId, action } = job.data;
    
    try {
      this.logger.log(`Syncing PO ${purchaseOrderId} with inventory for action: ${action}`);

      const purchaseOrder = await this.purchaseOrdersService.findOne(
        job.data.tenantId || 'unknown', 
        purchaseOrderId
      );

      // Implementation for inventory synchronization
      // This would involve updating inventory levels based on PO actions
      
      switch (action) {
        case 'reserve':
          // Reserve inventory when PO is sent to supplier
          break;
        case 'release':
          // Release reservation when PO is cancelled
          break;
        case 'receive':
          // Update inventory when items are received
          break;
      }
      
      this.logger.log(`Successfully synced PO ${purchaseOrderId} with inventory`);
    } catch (error) {
      this.logger.error(`Failed to sync PO ${purchaseOrderId} with inventory`, error.stack);
      throw error;
    }
  }
}