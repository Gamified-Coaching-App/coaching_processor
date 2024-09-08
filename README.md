# Coaching Processor

## Overview

Source code for Coaching Processor

## Directory Structure

```bash
src/
    ├── dailyLambdaTrigger/         # Code for intermediary Lambda function triggered by AWS Eventbridge
    ├── dailyLog/                   # Handles daily log processing
    ├── heartRateZones/             # Code related to heart rate zone calculations
    ├── loadTargets/                # Responsible for getting inference and processing load targets
    ├── overarchingUtils/           # Utility functions shared across different components
    ├── subjectiveParams/           # Handles subjective parameter data processing
    ├── trainingPlans/              # Manages training plans processing
    ├── app.mjs                     # Main entry point script for the application
