/**
 * ULTRATHINK: SHARED CUSTOMER ENUMS
 * Extracted to prevent circular import dependencies
 * Used across customer entities (journey, interaction, touchpoint)
 */

export enum CustomerJourneyStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  PAUSED = 'paused',
  CONVERTED = 'converted',
}

export enum CustomerJourneyType {
  AWARENESS = 'awareness',
  CONSIDERATION = 'consideration',
  PURCHASE = 'purchase',
  RETENTION = 'retention',
  ADVOCACY = 'advocacy',
  SUPPORT = 'support',
  REACTIVATION = 'reactivation',
}

export enum CustomerJourneyChannel {
  WEBSITE = 'website',
  MOBILE_APP = 'mobile_app',
  SOCIAL_MEDIA = 'social_media',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PHONE = 'phone',
  IN_STORE = 'in_store',
  MARKETPLACE = 'marketplace',
  REFERRAL = 'referral',
}

export enum TouchpointType {
  WEBSITE_VISIT = 'website_visit',
  PRODUCT_VIEW = 'product_view',
  CART_ADDITION = 'cart_addition',
  CART_ABANDONMENT = 'cart_abandonment',
  CHECKOUT_START = 'checkout_start',
  PURCHASE_COMPLETION = 'purchase_completion',
  EMAIL_OPEN = 'email_open',
  EMAIL_CLICK = 'email_click',
  SMS_RECEIVED = 'sms_received',
  WHATSAPP_MESSAGE = 'whatsapp_message',
  SOCIAL_MEDIA_ENGAGEMENT = 'social_media_engagement',
  CUSTOMER_SUPPORT_CONTACT = 'customer_support_contact',
  SUPPORT_TICKET_CREATED = 'support_ticket_created',
  SUPPORT_TICKET_RESOLVED = 'support_ticket_resolved',
  PHONE_CALL = 'phone_call',
  LIVE_CHAT = 'live_chat',
  KNOWLEDGE_BASE_ACCESS = 'knowledge_base_access',
  REVIEW_SUBMISSION = 'review_submission',
  REFERRAL_MADE = 'referral_made',
  LOYALTY_PROGRAM_ENROLLMENT = 'loyalty_program_enrollment',
  LOYALTY_REWARD_REDEEMED = 'loyalty_reward_redeemed',
  NEWSLETTER_SUBSCRIPTION = 'newsletter_subscription',
  WEBINAR_ATTENDANCE = 'webinar_attendance',
  MOBILE_APP_INSTALL = 'mobile_app_install',
  MOBILE_APP_LAUNCH = 'mobile_app_launch',
  PUSH_NOTIFICATION_RECEIVED = 'push_notification_received',
  IN_STORE_VISIT = 'in_store_visit',
  MARKETPLACE_INTERACTION = 'marketplace_interaction',
  PAYMENT_METHOD_ADDED = 'payment_method_added',
  SHIPPING_NOTIFICATION = 'shipping_notification',
  DELIVERY_COMPLETION = 'delivery_completion',
  RETURN_REQUEST = 'return_request',
  REFUND_PROCESSED = 'refund_processed',
  // Indonesian Cultural Touchpoints
  RAMADAN_CONTENT_ACCESS = 'ramadan_content_access',
  LEBARAN_PROMOTION_VIEW = 'lebaran_promotion_view',
  CULTURAL_EVENT_INVITATION = 'cultural_event_invitation',
  LOCAL_COMMUNITY_ENGAGEMENT = 'local_community_engagement',
  REGIONAL_CONTENT_INTERACTION = 'regional_content_interaction',
}

export enum TouchpointStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum InteractionType {
  // Communication Interactions
  EMAIL_SENT = 'email_sent',
  EMAIL_OPENED = 'email_opened',
  EMAIL_CLICKED = 'email_clicked',
  EMAIL_REPLIED = 'email_replied',
  SMS_SENT = 'sms_sent',
  SMS_RECEIVED = 'sms_received',
  WHATSAPP_MESSAGE_SENT = 'whatsapp_message_sent',
  WHATSAPP_MESSAGE_RECEIVED = 'whatsapp_message_received',
  PHONE_CALL_MADE = 'phone_call_made',
  PHONE_CALL_RECEIVED = 'phone_call_received',
  LIVE_CHAT_INITIATED = 'live_chat_initiated',
  LIVE_CHAT_MESSAGE = 'live_chat_message',

  // Website/App Interactions
  PAGE_VIEW = 'page_view',
  BUTTON_CLICK = 'button_click',
  FORM_SUBMISSION = 'form_submission',
  SEARCH_PERFORMED = 'search_performed',
  DOWNLOAD_INITIATED = 'download_initiated',
  VIDEO_WATCHED = 'video_watched',
  CONTENT_SHARED = 'content_shared',

  // E-commerce Interactions
  PRODUCT_VIEWED = 'product_viewed',
  PRODUCT_COMPARED = 'product_compared',
  CART_ITEM_ADDED = 'cart_item_added',
  CART_ITEM_REMOVED = 'cart_item_removed',
  WISHLIST_ADDED = 'wishlist_added',
  CHECKOUT_INITIATED = 'checkout_initiated',
  PAYMENT_ATTEMPTED = 'payment_attempted',
  PAYMENT_COMPLETED = 'payment_completed',
  ORDER_PLACED = 'order_placed',
  ORDER_CANCELLED = 'order_cancelled',

  // Support Interactions
  SUPPORT_TICKET_CREATED = 'support_ticket_created',
  SUPPORT_TICKET_RESPONDED = 'support_ticket_responded',
  SUPPORT_TICKET_RESOLVED = 'support_ticket_resolved',
  FAQ_VIEWED = 'faq_viewed',
  HELP_DOCUMENT_ACCESSED = 'help_document_accessed',

  // Engagement Interactions
  NEWSLETTER_SUBSCRIBED = 'newsletter_subscribed',
  NEWSLETTER_UNSUBSCRIBED = 'newsletter_unsubscribed',
  REVIEW_WRITTEN = 'review_written',
  RATING_GIVEN = 'rating_given',
  REFERRAL_MADE = 'referral_made',
  LOYALTY_POINTS_EARNED = 'loyalty_points_earned',
  LOYALTY_POINTS_REDEEMED = 'loyalty_points_redeemed',

  // Indonesian Cultural Interactions
  RAMADAN_CONTENT_ACCESSED = 'ramadan_content_accessed',
  LEBARAN_PROMO_VIEWED = 'lebaran_promo_viewed',
  LOCAL_PAYMENT_METHOD_USED = 'local_payment_method_used',
  REGIONAL_CONTENT_ACCESSED = 'regional_content_accessed',
  CULTURAL_EVENT_PARTICIPATION = 'cultural_event_participation',
}

export enum InteractionStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export enum InteractionSentiment {
  VERY_POSITIVE = 'very_positive',
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  VERY_NEGATIVE = 'very_negative',
}
