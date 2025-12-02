module.exports = function mapErrorToFriendlyToast(err) {
    if (!err) return "Unexpected error occurred.";

    const msg = err.toString();

    if (msg.includes("SQLITE_CONSTRAINT")) {
        if (msg.includes("placements.candidate_id")) {
            return "This candidate is already assigned to that job.";
        }
        if (msg.includes("candidates.passportNo")) {
            return "Duplicate passport number found.";
        }
        if (msg.includes("candidates.aadhar")) {
            return "Duplicate Aadhar number found.";
        }
        return "Duplicate entry found. Please check details.";
    }

    if (msg.includes("Validation failed")) {
        return "Some fields need correction. Please review.";
    }

    return msg;
};
