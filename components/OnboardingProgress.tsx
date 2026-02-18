'use client';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function OnboardingProgress({ currentStep, totalSteps, stepLabels }: OnboardingProgressProps) {
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`
                w-3 h-3 rounded-full transition-all duration-300
                ${index < currentStep 
                  ? 'bg-primary scale-100' 
                  : index === currentStep 
                    ? 'bg-primary-light scale-125 ring-4 ring-primary-light/30' 
                    : 'bg-border scale-100'
                }
              `}
            />
            {index < totalSteps - 1 && (
              <div 
                className={`w-8 h-0.5 mx-1 transition-colors duration-300
                  ${index < currentStep ? 'bg-primary' : 'bg-border'}
                `}
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Step label */}
      {stepLabels && stepLabels[currentStep] && (
        <p className="text-center text-sm text-text-muted">
          Step {currentStep + 1} of {totalSteps}: {stepLabels[currentStep]}
        </p>
      )}
    </div>
  );
}
