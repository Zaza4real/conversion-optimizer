import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSignup } from './entities/newsletter-signup.entity';

@Injectable()
export class LandingService {
  constructor(
    @InjectRepository(NewsletterSignup)
    private readonly newsletterRepo: Repository<NewsletterSignup>,
    private readonly config: ConfigService,
  ) {}

  /** Save email and optionally send notification to admin. Returns redirect URL. */
  async subscribeNewsletter(email: string, returnTo: string): Promise<{ redirect: string }> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      const fallback = returnTo?.trim() || '/';
      return { redirect: fallback.includes('?') ? `${fallback}&newsletter=invalid` : `${fallback}?newsletter=invalid` };
    }

    await this.newsletterRepo.save(this.newsletterRepo.create({ email: normalized }));

    const notifyTo = this.config.get<string>('NEWSLETTER_NOTIFY_EMAIL');
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (notifyTo && host && user && pass) {
      try {
        const nodemailer = await import('nodemailer');
        const port = Number(this.config.get<string>('SMTP_PORT')) || 587;
        const secure = this.config.get<string>('SMTP_SECURE') === 'true';
        const transporter = nodemailer.default.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
        });
        await transporter.sendMail({
          from: user,
          to: notifyTo,
          subject: `[Conversion Optimizer] New newsletter signup: ${normalized}`,
          text: `A visitor signed up for your email list.\n\nEmail: ${normalized}\nTime: ${new Date().toISOString()}`,
          html: `<p>A visitor signed up for your email list.</p><p><strong>Email:</strong> ${normalized}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
        });
      } catch {
        // Log but don't fail the request; signup is already stored
      }
    }

    const base = (returnTo?.trim() || '/').replace(/#.*$/, '');
    const sep = base.includes('?') ? '&' : '?';
    return { redirect: `${base}${sep}newsletter=success` };
  }
}
