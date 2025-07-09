import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export enum EmailTemplateType {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password-reset',
  EMAIL_VERIFICATION = 'email-verification',
  ORDER_CONFIRMATION = 'order-confirmation',
  INVENTORY_ALERT = 'inventory-alert',
  LOW_STOCK_ALERT = 'low-stock-alert',
  PURCHASE_ORDER_CREATED = 'purchase-order-created',
  PURCHASE_ORDER_APPROVED = 'purchase-order-approved',
  SYSTEM_NOTIFICATION = 'system-notification',
  MONTHLY_REPORT = 'monthly-report',
  INVOICE = 'invoice',
  RAMADAN_PROMOTION = 'ramadan-promotion',
  LEBARAN_GREETING = 'lebaran-greeting',
}

export interface EmailTemplateData {
  [key: string]: any;
  // Common Indonesian business context
  recipientName?: string;
  companyName?: string;
  currentDate?: string;
  indonesianGreeting?: string;
  culturalContext?: {
    isRamadan?: boolean;
    isLebaran?: boolean;
    timeOfDay?: 'pagi' | 'siang' | 'sore' | 'malam';
  };
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly templatesPath: string;
  private templateCache = new Map<string, any>();

  constructor(private readonly configService: ConfigService) {
    this.templatesPath = path.join(
      process.cwd(),
      'src',
      'notifications',
      'templates',
      'email',
    );
    this.ensureTemplatesDirectory();
    this.registerHelpers();
  }

  private ensureTemplatesDirectory(): void {
    if (!fs.existsSync(this.templatesPath)) {
      fs.mkdirSync(this.templatesPath, { recursive: true });
      this.logger.log(
        `Created email templates directory: ${this.templatesPath}`,
      );
    }
  }

  private registerHelpers(): void {
    // Indonesian date formatting helper
    Handlebars.registerHelper('formatIndonesianDate', (date: Date | string) => {
      const d = new Date(date);
      const months = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember',
      ];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    });

    // Indonesian currency formatting
    Handlebars.registerHelper('formatIDR', (amount: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);
    });

    // Indonesian greeting based on time
    Handlebars.registerHelper('indonesianGreeting', (timeOfDay?: string) => {
      const hour = new Date().getHours();
      if (timeOfDay) {
        switch (timeOfDay) {
          case 'pagi':
            return 'Selamat pagi';
          case 'siang':
            return 'Selamat siang';
          case 'sore':
            return 'Selamat sore';
          case 'malam':
            return 'Selamat malam';
        }
      }

      if (hour < 11) return 'Selamat pagi';
      if (hour < 15) return 'Selamat siang';
      if (hour < 18) return 'Selamat sore';
      return 'Selamat malam';
    });

    // Conditional helper for cultural context
    Handlebars.registerHelper('ifRamadan', function (context, options) {
      const now = new Date();
      const month = now.getMonth() + 1; // 0-indexed to 1-indexed
      // Approximate Ramadan months (this should be dynamic based on Islamic calendar)
      const isRamadan =
        context?.culturalContext?.isRamadan || [3, 4, 5].includes(month);
      return isRamadan ? options.fn(this) : options.inverse(this);
    });

    // Indonesian business formal closing
    Handlebars.registerHelper('businessClosing', () => {
      return 'Hormat kami,<br>Tim StokCerdas';
    });
  }

  async renderTemplate(
    templateType: EmailTemplateType,
    templateData: EmailTemplateData,
    language: 'id' | 'en' = 'id',
  ): Promise<RenderedTemplate> {
    try {
      this.logger.debug(
        `Rendering email template: ${templateType} (${language})`,
      );

      // Get template files
      const templateFiles = await this.getTemplateFiles(templateType, language);

      // Enhance template data with Indonesian context
      const enhancedData = await this.enhanceTemplateData(templateData);

      // Compile and render templates
      const subjectTemplate = Handlebars.compile(templateFiles.subject);
      const htmlTemplate = Handlebars.compile(templateFiles.html);
      const textTemplate = Handlebars.compile(templateFiles.text);

      const result: RenderedTemplate = {
        subject: subjectTemplate(enhancedData),
        html: htmlTemplate(enhancedData),
        text: textTemplate(enhancedData),
      };

      this.logger.debug(`Template rendered successfully: ${templateType}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateType}: ${error.message}`,
      );
      throw new NotFoundException(
        `Email template not found or invalid: ${templateType}`,
      );
    }
  }

  private async getTemplateFiles(
    templateType: EmailTemplateType,
    language: 'id' | 'en',
  ): Promise<{ subject: string; html: string; text: string }> {
    const templateDir = path.join(this.templatesPath, language, templateType);

    const subjectPath = path.join(templateDir, 'subject.hbs');
    const htmlPath = path.join(templateDir, 'html.hbs');
    const textPath = path.join(templateDir, 'text.hbs');

    // Check if template exists, fallback to default if not
    const fallbackDir = path.join(this.templatesPath, 'id', 'default');

    const subject =
      (await this.readTemplateFile(subjectPath)) ||
      (await this.readTemplateFile(path.join(fallbackDir, 'subject.hbs'))) ||
      'Notifikasi dari StokCerdas';

    const html =
      (await this.readTemplateFile(htmlPath)) ||
      (await this.readTemplateFile(path.join(fallbackDir, 'html.hbs'))) ||
      (await this.getDefaultHtmlTemplate());

    const text =
      (await this.readTemplateFile(textPath)) ||
      (await this.readTemplateFile(path.join(fallbackDir, 'text.hbs'))) ||
      (await this.getDefaultTextTemplate());

    return { subject, html, text };
  }

  private async readTemplateFile(filePath: string): Promise<string | null> {
    try {
      const cacheKey = filePath;

      if (this.templateCache.has(cacheKey)) {
        return this.templateCache.get(cacheKey);
      }

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.templateCache.set(cacheKey, content);
        return content;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error reading template file ${filePath}: ${error.message}`,
      );
      return null;
    }
  }

  private async enhanceTemplateData(
    templateData: EmailTemplateData,
  ): Promise<EmailTemplateData> {
    const now = new Date();
    const hour = now.getHours();

    // Determine time of day in Indonesian context
    let timeOfDay: 'pagi' | 'siang' | 'sore' | 'malam';
    if (hour < 11) timeOfDay = 'pagi';
    else if (hour < 15) timeOfDay = 'siang';
    else if (hour < 18) timeOfDay = 'sore';
    else timeOfDay = 'malam';

    // Check if it's Ramadan period (simplified - should use proper Islamic calendar)
    const month = now.getMonth() + 1;
    const isRamadan = [3, 4, 5].includes(month);
    const isLebaran = month === 5 && now.getDate() <= 7; // Simplified Lebaran detection

    return {
      ...templateData,
      currentDate: now.toISOString(),
      indonesianGreeting: timeOfDay,
      companyName: templateData.companyName || 'StokCerdas',
      culturalContext: {
        isRamadan,
        isLebaran,
        timeOfDay,
        ...templateData.culturalContext,
      },
      // Add system info
      systemInfo: {
        appName: 'StokCerdas',
        supportEmail: this.configService.get<string>(
          'SUPPORT_EMAIL',
          'support@stokcerdas.com',
        ),
        websiteUrl: this.configService.get<string>(
          'WEBSITE_URL',
          'https://stokcerdas.com',
        ),
      },
    };
  }

  private async getDefaultHtmlTemplate(): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; line-height: 1.6; color: #333; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .cultural-note { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{systemInfo.appName}}</h1>
            <p>Solusi Cerdas untuk Manajemen Inventori</p>
        </div>
        <div class="content">
            <p>{{indonesianGreeting}}, {{recipientName}}!</p>
            
            {{#ifRamadan}}
            <div class="cultural-note">
                <p><strong>Ramadan Mubarak!</strong> Semoga bulan suci ini membawa berkah untuk bisnis Anda.</p>
            </div>
            {{/ifRamadan}}
            
            <p>Kami mengirimkan email ini untuk memberitahukan:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                {{{content}}}
            </div>
            
            <p>Terima kasih telah menggunakan {{systemInfo.appName}}. Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi kami.</p>
            
            {{{businessClosing}}}
        </div>
        <div class="footer">
            <p>&copy; 2025 {{systemInfo.appName}}. Semua hak dilindungi.</p>
            <p>Email: {{systemInfo.supportEmail}} | Website: {{systemInfo.websiteUrl}}</p>
        </div>
    </div>
</body>
</html>`;
  }

  private async getDefaultTextTemplate(): Promise<string> {
    return `
{{indonesianGreeting}}, {{recipientName}}!

{{#ifRamadan}}
Ramadan Mubarak! Semoga bulan suci ini membawa berkah untuk bisnis Anda.
{{/ifRamadan}}

Kami mengirimkan email ini untuk memberitahukan:

{{{content}}}

Terima kasih telah menggunakan {{systemInfo.appName}}. Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi kami.

Hormat kami,
Tim {{systemInfo.appName}}

---
{{systemInfo.appName}} - Solusi Cerdas untuk Manajemen Inventori
Email: {{systemInfo.supportEmail}}
Website: {{systemInfo.websiteUrl}}
`;
  }

  async createDefaultTemplates(): Promise<void> {
    this.logger.log('Creating default email templates...');

    const defaultTemplates = [
      {
        type: EmailTemplateType.WELCOME,
        subject: 'Selamat datang di {{systemInfo.appName}}!',
        content:
          'Terima kasih telah bergabung dengan platform manajemen inventori terdepan di Indonesia.',
      },
      {
        type: EmailTemplateType.LOW_STOCK_ALERT,
        subject: 'Peringatan: Stok {{productName}} menipis',
        content:
          'Produk {{productName}} di {{locationName}} tersisa {{currentStock}} unit. Segera lakukan pemesanan ulang.',
      },
      {
        type: EmailTemplateType.ORDER_CONFIRMATION,
        subject: 'Konfirmasi Pesanan #{{orderNumber}}',
        content:
          'Pesanan Anda dengan nomor {{orderNumber}} telah dikonfirmasi dan sedang diproses.',
      },
    ];

    for (const template of defaultTemplates) {
      await this.createTemplateFiles(
        template.type,
        template.subject,
        template.content,
      );
    }

    this.logger.log('Default email templates created successfully');
  }

  private async createTemplateFiles(
    templateType: EmailTemplateType,
    subject: string,
    content: string,
  ): Promise<void> {
    const templateDir = path.join(this.templatesPath, 'id', templateType);

    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // Create subject template
    fs.writeFileSync(path.join(templateDir, 'subject.hbs'), subject);

    // Create HTML template with content placeholder
    const htmlTemplate = (await this.getDefaultHtmlTemplate()).replace(
      '{{{content}}}',
      content,
    );
    fs.writeFileSync(path.join(templateDir, 'html.hbs'), htmlTemplate);

    // Create text template with content placeholder
    const textTemplate = (await this.getDefaultTextTemplate()).replace(
      '{{{content}}}',
      content,
    );
    fs.writeFileSync(path.join(templateDir, 'text.hbs'), textTemplate);
  }

  clearTemplateCache(): void {
    this.templateCache.clear();
    this.logger.log('Email template cache cleared');
  }

  getAvailableTemplates(): EmailTemplateType[] {
    return Object.values(EmailTemplateType);
  }
}
