import { useState, useCallback } from 'react';
import { sanitizeObject } from '../utils/sanitize';

export const useFormValidation = (schema) => {
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (data) => {
    setIsValidating(true);
    setErrors({});
    
    try {
      // Sanitize input data first
      const sanitizedData = sanitizeObject(data);
      
      // Validate with Zod schema
      await schema.parseAsync(sanitizedData);
      setIsValidating(false);
      return { isValid: true, data: sanitizedData };
    } catch (error) {
      if (error.errors) {
        const formattedErrors = {};
        error.errors.forEach((err) => {
          const field = err.path[0];
          formattedErrors[field] = err.message;
        });
        setErrors(formattedErrors);
      }
      setIsValidating(false);
      return { isValid: false, errors: error.errors };
    }
  }, [schema]);

  const validateField = useCallback(async (fieldName, value) => {
    try {
      await schema.shape[fieldName].parseAsync(value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    } catch (error) {
      if (error.errors) {
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error.errors[0].message,
        }));
      }
      return false;
    }
  }, [schema]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  return {
    errors,
    isValidating,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
  };
};
export default useFormValidation;