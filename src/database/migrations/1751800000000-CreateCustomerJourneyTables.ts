import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCustomerJourneyTables1751800000000
  implements MigrationInterface
{
  name = 'CreateCustomerJourneyTables1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create customer_journeys table
    await queryRunner.createTable(
      new Table({
        name: 'customer_journeys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'completed', 'abandoned', 'paused', 'converted'],
            default: "'active'",
          },
          {
            name: 'journey_type',
            type: 'enum',
            enum: [
              'awareness',
              'consideration',
              'purchase',
              'retention',
              'advocacy',
              'support',
              'reactivation',
            ],
            isNullable: false,
          },
          {
            name: 'primary_channel',
            type: 'enum',
            enum: [
              'website',
              'mobile_app',
              'social_media',
              'email',
              'sms',
              'whatsapp',
              'phone',
              'in_store',
              'marketplace',
              'referral',
            ],
            isNullable: false,
          },
          {
            name: 'journey_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'journey_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'journey_goal',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expected_completion_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_interaction_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'total_touchpoints',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_interactions',
            type: 'int',
            default: 0,
          },
          {
            name: 'journey_duration_hours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'conversion_achieved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'conversion_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'conversion_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'engagement_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'satisfaction_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'effort_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'net_promoter_score',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'journey_metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'journey_analytics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'source_campaign',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'source_medium',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_referrer',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'utm_parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'device_info',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'priority_score',
            type: 'int',
            default: 50,
          },
          {
            name: 'is_high_value',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_vip_customer',
            type: 'boolean',
            default: false,
          },
          {
            name: 'requires_personal_attention',
            type: 'boolean',
            default: false,
          },
          {
            name: 'escalation_level',
            type: 'int',
            default: 0,
          },
          {
            name: 'assigned_agent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'internal_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create customer_touchpoints table
    await queryRunner.createTable(
      new Table({
        name: 'customer_touchpoints',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'journey_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'touchpoint_type',
            type: 'enum',
            enum: [
              'website_visit',
              'product_view',
              'cart_addition',
              'cart_abandonment',
              'checkout_start',
              'purchase_completion',
              'email_open',
              'email_click',
              'sms_received',
              'whatsapp_message',
              'social_media_engagement',
              'customer_support_contact',
              'support_ticket_created',
              'support_ticket_resolved',
              'phone_call',
              'live_chat',
              'knowledge_base_access',
              'review_submission',
              'referral_made',
              'loyalty_program_enrollment',
              'loyalty_reward_redeemed',
              'newsletter_subscription',
              'webinar_attendance',
              'mobile_app_install',
              'mobile_app_launch',
              'push_notification_received',
              'in_store_visit',
              'marketplace_interaction',
              'payment_method_added',
              'shipping_notification',
              'delivery_completion',
              'return_request',
              'refund_processed',
            ],
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'enum',
            enum: [
              'website',
              'mobile_app',
              'social_media',
              'email',
              'sms',
              'whatsapp',
              'phone',
              'in_store',
              'marketplace',
              'referral',
            ],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'active',
              'completed',
              'failed',
              'abandoned',
              'pending',
              'cancelled',
            ],
            default: "'active'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'critical'],
            default: "'medium'",
          },
          {
            name: 'touchpoint_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'touchpoint_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'occurred_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'sequence_number',
            type: 'int',
            default: 1,
          },
          {
            name: 'is_conversion_touchpoint',
            type: 'boolean',
            default: false,
          },
          {
            name: 'conversion_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'touchpoint_metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'touchpoint_analytics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'page_url',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'referrer_url',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'campaign_source',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'campaign_medium',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'campaign_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'utm_parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'device_info',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'content_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'interaction_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'business_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sentiment_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'satisfaction_rating',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'effort_rating',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'net_promoter_score',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'feedback_text',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'agent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'agent_rating',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'resolution_time_minutes',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'escalation_level',
            type: 'int',
            default: 0,
          },
          {
            name: 'requires_followup',
            type: 'boolean',
            default: false,
          },
          {
            name: 'followup_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'internal_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create customer_interactions table
    await queryRunner.createTable(
      new Table({
        name: 'customer_interactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'journey_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'touchpoint_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'interaction_type',
            type: 'enum',
            enum: [
              'email_sent',
              'email_opened',
              'email_clicked',
              'email_replied',
              'sms_sent',
              'sms_received',
              'whatsapp_message_sent',
              'whatsapp_message_received',
              'phone_call_made',
              'phone_call_received',
              'live_chat_initiated',
              'live_chat_message',
              'page_view',
              'button_click',
              'form_submission',
              'search_performed',
              'download_initiated',
              'video_watched',
              'content_shared',
              'product_viewed',
              'product_compared',
              'cart_item_added',
              'cart_item_removed',
              'wishlist_added',
              'checkout_initiated',
              'payment_attempted',
              'payment_completed',
              'order_placed',
              'order_cancelled',
              'support_ticket_created',
              'support_ticket_updated',
              'support_ticket_resolved',
              'faq_accessed',
              'knowledge_base_searched',
              'feedback_provided',
              'complaint_filed',
              'social_media_follow',
              'social_media_like',
              'social_media_share',
              'social_media_comment',
              'review_submitted',
              'referral_made',
              'newsletter_subscribed',
              'loyalty_points_earned',
              'loyalty_points_redeemed',
              'promotion_applied',
              'survey_completed',
              'webinar_attended',
              'ramadan_greeting_sent',
              'lebaran_promotion_viewed',
              'local_payment_method_used',
              'regional_content_accessed',
              'cultural_event_participation',
            ],
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'enum',
            enum: [
              'website',
              'mobile_app',
              'social_media',
              'email',
              'sms',
              'whatsapp',
              'phone',
              'in_store',
              'marketplace',
              'referral',
            ],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'initiated',
              'in_progress',
              'completed',
              'failed',
              'cancelled',
              'timeout',
            ],
            default: "'initiated'",
          },
          {
            name: 'sentiment',
            type: 'enum',
            enum: [
              'very_positive',
              'positive',
              'neutral',
              'negative',
              'very_negative',
            ],
            isNullable: true,
          },
          {
            name: 'interaction_title',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'interaction_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'interaction_content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'occurred_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'response_time_ms',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'sequence_in_touchpoint',
            type: 'int',
            default: 1,
          },
          {
            name: 'is_automated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_personalized',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_conversion_interaction',
            type: 'boolean',
            default: false,
          },
          {
            name: 'conversion_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'interaction_metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'interaction_analytics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'content_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'user_input',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'system_response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'contextual_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'business_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'satisfaction_feedback',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'engagement_metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'priority_score',
            type: 'int',
            default: 50,
          },
          {
            name: 'quality_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'influence_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'next_interaction_predicted',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'agent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'agent_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'agent_rating',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'escalation_required',
            type: 'boolean',
            default: false,
          },
          {
            name: 'followup_required',
            type: 'boolean',
            default: false,
          },
          {
            name: 'followup_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolution_achieved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'internal_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for customer_journeys
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_customer',
        columnNames: ['tenant_id', 'customer_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_journey_type',
        columnNames: ['tenant_id', 'journey_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_primary_channel',
        columnNames: ['tenant_id', 'primary_channel'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_started_at',
        columnNames: ['tenant_id', 'started_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_completed_at',
        columnNames: ['tenant_id', 'completed_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_journeys',
      new TableIndex({
        name: 'IDX_customer_journeys_tenant_is_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create indexes for customer_touchpoints
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_customer',
        columnNames: ['tenant_id', 'customer_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_journey',
        columnNames: ['tenant_id', 'journey_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_touchpoint_type',
        columnNames: ['tenant_id', 'touchpoint_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_channel',
        columnNames: ['tenant_id', 'channel'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_occurred_at',
        columnNames: ['tenant_id', 'occurred_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_touchpoints',
      new TableIndex({
        name: 'IDX_customer_touchpoints_tenant_is_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create indexes for customer_interactions
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_customer',
        columnNames: ['tenant_id', 'customer_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_journey',
        columnNames: ['tenant_id', 'journey_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_touchpoint',
        columnNames: ['tenant_id', 'touchpoint_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_interaction_type',
        columnNames: ['tenant_id', 'interaction_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_channel',
        columnNames: ['tenant_id', 'channel'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_occurred_at',
        columnNames: ['tenant_id', 'occurred_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        name: 'IDX_customer_interactions_tenant_is_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'customer_journeys',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_touchpoints',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_touchpoints',
      new TableForeignKey({
        columnNames: ['journey_id'],
        referencedTableName: 'customer_journeys',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_interactions',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_interactions',
      new TableForeignKey({
        columnNames: ['journey_id'],
        referencedTableName: 'customer_journeys',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_interactions',
      new TableForeignKey({
        columnNames: ['touchpoint_id'],
        referencedTableName: 'customer_touchpoints',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const customerInteractionsTable = await queryRunner.getTable(
      'customer_interactions',
    );
    const customerTouchpointsTable = await queryRunner.getTable(
      'customer_touchpoints',
    );
    const customerJourneysTable = await queryRunner.getTable(
      'customer_journeys',
    );

    if (customerInteractionsTable) {
      const foreignKeys = customerInteractionsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('customer_interactions', foreignKey);
      }
    }

    if (customerTouchpointsTable) {
      const foreignKeys = customerTouchpointsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('customer_touchpoints', foreignKey);
      }
    }

    if (customerJourneysTable) {
      const foreignKeys = customerJourneysTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('customer_journeys', foreignKey);
      }
    }

    // Drop tables
    await queryRunner.dropTable('customer_interactions', true);
    await queryRunner.dropTable('customer_touchpoints', true);
    await queryRunner.dropTable('customer_journeys', true);
  }
}
