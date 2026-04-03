# LLM Studio Examples

This file shows what `LLM Studio` is for and how to use it with this project.

## What LLM Studio Is

`LLM Studio` is the local AI helper for your ML projects.

It does **not** train the image model itself.

Instead, it helps you:

- design dataset classes
- improve prompts
- understand failures
- decide what new data to collect
- review deployment risk

## Simple Difference

- Image model: looks at an image and predicts a label like `Dharshaneshwaran`
- LLM Studio: helps you improve the whole system around that model

## Example 1: Prompt-to-Dataset Builder

Use when:
- you only have an idea and want class names and data rules

Project context:

```text
Project: Office Face Recognition
Goal: Recognize employees at the entrance
Need: person identity recognition using local GPU training
```

Workflow input:

```text
I want to recognize Dharshaneshwaran, Kavin, and visitors. Tell me what classes I should create and what photos I should collect.
```

Good output should include:

- class list:
  - `dharshaneshwaran`
  - `kavin`
  - `visitor`
- image collection advice:
  - front face
  - left/right angle
  - indoor and outdoor light
  - glasses / no glasses
  - near / far camera

## Example 2: Failure-to-Training Loop

Use when:
- the model gives the wrong result
- confidence is low
- a person is often confused with another person

Project context:

```text
Project: Office Face Recognition
Classes: dharshaneshwaran, kavin, visitor
Model: image classification
```

Workflow input:

```text
The model predicted Kavin for a new Dharshaneshwaran image with 58% confidence. The image was taken in low light from a side angle.
```

Good output should include:

- likely cause:
  - not enough side-angle Dharshaneshwaran images
  - low-light samples missing
- data to collect next:
  - 15 low-light images
  - 15 side-angle images
  - 10 images with different backgrounds

## Example 3: Deployment Safety Reviewer

Use when:
- you want to know if the system is safe enough to use

Project context:

```text
Project: Access Control
Environment: office entrance
Users: employees and visitors
```

Workflow input:

```text
This system will unlock a door when a person is recognized. What risks should I watch before pilot rollout?
```

Good output should include:

- false-accept risk
- false-reject risk
- fallback to manual verification
- confidence threshold advice
- monitoring suggestions

## Example 4: Recognition Feature

This is the actual ML flow, not the LLM flow.

1. Enroll images with prompt:

```text
This is Dharshaneshwaran
```

2. Enroll another class too:

```text
This is Kavin
```

3. Train the image model
4. Deploy it
5. Open `Recognize Person`
6. Upload a new image
7. The trained model predicts which enrolled person it matches

## Example 5: English-To-Training Auto Build

Use when:
- you want the app to turn one English request into a real project
- you want it to search for a public dataset and begin training locally

Example request in `LLM Studio`:

```text
Train a model to identify which waste is biodegradable and which is not biodegradable.
```

What the app tries to do:

1. Interpret the request as a supported project template such as `waste-sorting`
2. Generate dataset search queries for Kaggle
3. Download a matching public image dataset
4. Create a new project automatically
5. Auto-assign a sensible epoch count from the prompt, image count, and number of classes unless you override it
6. Start local training with the configured image backbone
7. Use CUDA when available, and fail fast if GPU-required mode is enabled without CUDA

What you will see in the UI:

- a terminal-style build console with each planning and dataset step
- the selected dataset and labels
- the chosen training epochs and the reason for that choice

What you need first:

- a working local backend
- Kaggle credentials in `backend/.env`
- local training dependencies installed
- CUDA-ready PyTorch if you want enforced GPU-only training

Best use cases:

- biodegradable vs non-biodegradable waste
- person recognition prototypes
- basic document image classification

Current limit:

- this auto-build flow is meant for image-classification projects and Kaggle-hosted public datasets right now

## Best Way To Use Both Together

1. Use dataset enrollment to create labels and upload images
2. Train the model locally
3. Use `Recognize Person` for prediction
4. If results are weak, use `LLM Studio`
5. Ask LLM Studio what new data to collect and how to improve the project
