class ExportManager {
  /**
   * Export candidates to CSV
   */
  async exportCandidates(options = {}) {
    try {
      const result = await window.electronAPI.exportCandidates({
        format: options.format || 'csv',
        filters: options.filters || {},
        fields: options.fields || 'all',
      });

      return result;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export to PDF report
   */
  async exportToPDF(data, template = 'default') {
    try {
      const result = await window.electronAPI.exportToPDF({
        data,
        template,
        options: {
          includeCharts: true,
          includePhotos: false,
        },
      });

      return result;
    } catch (error) {
      console.error('PDF export error:', error);
      throw error;
    }
  }

  /**
   * Bulk import candidates from CSV/Excel
   */
  async importCandidates(file, options = {}) {
    try {
      const result = await window.electronAPI.importCandidates({
        filePath: file.path,
        format: file.type,
        validateOnly: options.validateOnly || false,
        skipDuplicates: options.skipDuplicates !== false,
      });

      return result;
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }
}

export const exportManager = new ExportManager();
// Phone number: E.164 format
// Optional, can be empty string