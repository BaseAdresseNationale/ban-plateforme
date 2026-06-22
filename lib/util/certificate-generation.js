export const CERTIFICATE_MAINTENANCE_MESSAGES = {
  admin: 'Admin access is temporarily disabled.',
  adminOptions: 'Admin options configuration is temporarily disabled.',
  districtConfig: 'District config modification is temporarily disabled.',
  certificate: 'Certificate generation is temporarily disabled.',
}

export const isCertificateGenerationEnabled = () =>
  Number.parseInt(process.env.CERTIFICATE_GENERATION_ENABLED ?? '1', 10) === 1
