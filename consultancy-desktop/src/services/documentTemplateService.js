import { sanitizeText, sanitizeHTML } from '../utils/sanitize';

class DocumentTemplateService {
  constructor() {
    this.templates = new Map();
  }

  /**
   * Load templates
   */
  async loadTemplates() {
    try {
      const result = await window.electronAPI.getDocumentTemplates();
      if (result.success) {
        result.templates.forEach(template => {
          this.templates.set(template.id, template);
        });
      }
    } catch (error) {
      console.error('Error loading document templates:', error);
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId) {
    return this.templates.get(templateId);
  }

  /**
   * Parse template with candidate data
   */
  parseTemplate(template, data) {
    let content = template.content;

    // Replace all variables
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, sanitizeText(String(value || '')));
    });

    // Handle conditional blocks
    content = this.parseConditionals(content, data);

    // Handle loops
    content = this.parseLoops(content, data);

    return content;
  }

  /**
   * Parse conditional blocks {{#if variable}}...{{/if}}
   */
  parseConditionals(content, data) {
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    
    return content.replace(conditionalRegex, (match, variable, block) => {
      return data[variable] ? block : '';
    });
  }

  /**
   * Parse loop blocks {{#each items}}...{{/each}}
   */
  parseLoops(content, data) {
    const loopRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    
    return content.replace(loopRegex, (match, variable, block) => {
      const items = data[variable];
      if (!Array.isArray(items)) return '';

      return items.map(item => {
        let itemBlock = block;
        Object.entries(item).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemBlock = itemBlock.replace(regex, sanitizeText(String(value || '')));
        });
        return itemBlock;
      }).join('');
    });
  }

  /**
   * Generate document from template
   */
  async generateDocument(templateId, candidateId, format = 'pdf') {
    try {
      const result = await window.electronAPI.generateDocument({
        templateId,
        candidateId,
        format, // pdf, docx, html
      });

      return result;
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }

  /**
   * Generate offer letter
   */
  async generateOfferLetter(candidateId, jobDetails) {
    return this.generateDocument('offer_letter', candidateId, 'pdf');
  }

  /**
   * Generate experience certificate
   */
  async generateExperienceCertificate(candidateId) {
    return this.generateDocument('experience_certificate', candidateId, 'pdf');
  }

  /**
   * Generate visa application letter
   */
  async generateVisaLetter(candidateId, visaDetails) {
    return this.generateDocument('visa_letter', candidateId, 'pdf');
  }

  /**
   * Create custom template
   */
  async createTemplate(templateData) {
    try {
      const sanitizedData = {
        name: sanitizeText(templateData.name),
        description: sanitizeText(templateData.description || ''),
        content: sanitizeHTML(templateData.content),
        type: templateData.type, // offer_letter, experience, visa, custom
        variables: templateData.variables || [],
      };

      const result = await window.electronAPI.createDocumentTemplate(sanitizedData);
      
      if (result.success) {
        this.templates.set(result.template.id, result.template);
      }

      return result;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }
}

export const documentTemplateService = new DocumentTemplateService();
// Phone number: E.164 format