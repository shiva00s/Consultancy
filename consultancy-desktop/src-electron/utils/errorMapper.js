/**
 * Maps technical error messages to user-friendly toast messages
 * @param {Error|string} err - The error object or error message
 * @returns {string} - User-friendly error message
 */
export function mapErrorToFriendlyToast(err) {
  if (!err) return "Unexpected error occurred.";

  // Convert error to string for pattern matching
  const msg = typeof err === 'string' ? err : err.toString();

  // Database constraint errors
  if (msg.includes("SQLITE_CONSTRAINT") || msg.includes("UNIQUE constraint")) {
    if (msg.includes("placements.candidate_id") || msg.includes("already assigned")) {
      return "This candidate is already assigned to that job.";
    }
    if (msg.includes("candidates.passportNo") || msg.includes("passport")) {
      return "Duplicate passport number found.";
    }
    if (msg.includes("candidates.aadhar") || msg.includes("aadhar")) {
      return "Duplicate Aadhar number found.";
    }
    if (msg.includes("candidates.contact")) {
      return "Duplicate contact number found.";
    }
    if (msg.includes("documents")) {
      return "Duplicate document entry.";
    }
    if (msg.includes("job_orders")) {
      return "Duplicate job order entry.";
    }
    if (msg.includes("employers")) {
      return "Duplicate employer entry.";
    }
    return "Duplicate entry found. Please check your details.";
  }

  // Validation errors
  if (msg.includes("Validation failed") || msg.includes("validation")) {
    return "Some fields need correction. Please review your input.";
  }

  // File-related errors
  if (msg.includes("ENOENT") || msg.includes("file not found")) {
    return "File not found. It may have been moved or deleted.";
  }
  if (msg.includes("EACCES") || msg.includes("permission denied")) {
    return "Permission denied. Check file/folder permissions.";
  }
  if (msg.includes("file size") || msg.includes("too large")) {
    return "File is too large. Maximum size is 10MB.";
  }

  // Network/Connection errors
  if (msg.includes("Network") || msg.includes("fetch failed")) {
    return "Connection error. Please check your network.";
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "Request timed out. Please try again.";
  }

  // Database errors
  if (msg.includes("database") || msg.includes("SQLITE_ERROR")) {
    return "Database error. Please try again or contact support.";
  }
  if (msg.includes("locked") || msg.includes("SQLITE_BUSY")) {
    return "Database is busy. Please wait and try again.";
  }

  // React/Component errors
  if (msg.includes("Cannot read properties of undefined")) {
    return "Data loading error. Please refresh the page.";
  }
  if (msg.includes("Cannot read properties of null")) {
    return "Missing data. Please check if all required fields are filled.";
  }
  if (msg.includes("undefined is not an object")) {
    return "Component error. Please refresh the page.";
  }

  // Authentication/Authorization errors
  if (msg.includes("Unauthorized") || msg.includes("401")) {
    return "Session expired. Please log in again.";
  }
  if (msg.includes("Forbidden") || msg.includes("403")) {
    return "You don't have permission to perform this action.";
  }

  // Not found errors
  if (msg.includes("not found") || msg.includes("404")) {
    return "Record not found. It may have been deleted.";
  }

  // Generic fallback - try to clean up the message
  if (msg.length > 100) {
    // If message is too long, return generic error
    return "An error occurred. Please try again or contact support.";
  }

  // Return the original message if it's already user-friendly
  return msg.includes("Error:") ? msg.replace("Error:", "").trim() : msg;
}

/**
 * Shorthand function for showing error toasts
 * Usage: showErrorToast(error, toast)
 */
export function showErrorToast(err, toastInstance) {
  const message = mapErrorToFriendlyToast(err);
  toastInstance.error(message);
}

/**
 * Logs error to console while showing user-friendly message
 */
export function handleError(err, toastInstance, context = "") {
  // Log technical details for debugging
  console.error(`[${context}] Error:`, err);
  
  // Show user-friendly message
  const message = mapErrorToFriendlyToast(err);
  toastInstance.error(message);
}
