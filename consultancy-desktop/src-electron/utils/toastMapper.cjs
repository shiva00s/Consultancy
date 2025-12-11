export function mapErrorToFriendlyToast(err) {
  if (!err) return "Unexpected error occurred.";

  const msg = err.toString();

  if (msg.includes("SQLITE_CONSTRAINT") || msg.includes("UNIQUE constraint")) {
    if (msg.includes("placements.candidate_id") || msg.includes("already assigned")) {
      return "This candidate is already assigned to that job.";
    }
    if (msg.includes("candidates.passportNo")) {
      return "Duplicate passport number found.";
    }
    if (msg.includes("candidates.aadhar")) {
      return "Duplicate Aadhar number found.";
    }
    if (msg.includes("documents")) {
      return "Duplicate document entry.";
    }
    return "Duplicate entry found. Please check details.";
  }

  if (msg.includes("Validation failed")) {
    return "Some fields need correction. Please review.";
  }

  if (msg.includes("Cannot read properties of undefined")) {
    return "Data loading error. Please refresh the page.";
  }

  if (msg.includes("Network") || msg.includes("fetch")) {
    return "Connection error. Please check your network.";
  }

  // Return generic message for unknown errors
  return "Something went wrong. Please try again.";
}
