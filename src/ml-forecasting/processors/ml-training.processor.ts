import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { ModelTrainingService } from '../services/model-training.service';

export interface MLTrainingJobData {
  tenantId: string;
  modelId: string;
  jobId: string;
  trainingConfig: any;
}

@Processor('ml-training')
export class MLTrainingProcessor {
  private readonly logger = new Logger(MLTrainingProcessor.name);

  constructor(
    private readonly modelTrainingService: ModelTrainingService,
  ) {}

  @Process('train-model')
  async handleTrainModel(job: Job<MLTrainingJobData>): Promise<void> {
    this.logger.log(`Processing training job: ${job.id} for model: ${job.data.modelId}`);

    try {
      await this.modelTrainingService.executeTraining(
        job.data.tenantId,
        job.data.modelId,
        job.data.jobId,
        job.data.trainingConfig,
      );

      this.logger.log(`Training job completed successfully: ${job.id}`);
    } catch (error) {
      this.logger.error(`Training job failed: ${job.id}`, error.stack);
      throw error; // Re-throw to mark job as failed
    }
  }
}