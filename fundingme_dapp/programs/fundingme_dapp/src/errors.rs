use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Invalid project status for this operation")]
    InvalidProjectStatus,
    #[msg("Project is not available for this withdraw operation")]
    ProjectWithdrawNotAvailable,
    #[msg("User not authorized for this operation")]
    UserNotAuthorized,
}
