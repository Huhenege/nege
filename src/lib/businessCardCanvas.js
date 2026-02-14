const FIELD_PLACEHOLDER_REGEX = /\{\{\s*([^}]+)\s*\}\}/;

const DEFAULT_CARD_WIDTH = 1050;
const DEFAULT_CARD_HEIGHT = 600;
const DEFAULT_SAFE_MARGIN = 36;

const DEFAULT_TEXT_STYLE = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 34,
    fontWeight: '700',
    fill: '#111827',
    align: 'left',
    letterSpacing: 0
};

const DEFAULT_IMAGE_STYLE = {
    fill: '#E2E8F0',
    stroke: '#94A3B8',
    strokeWidth: 1,
    labelColor: '#334155'
};

const DEFAULT_NODES = [
    {
        id: 'node_full_name',
        kind: 'text',
        field: 'fullName',
        sample: 'John Doe',
        x: 74,
        y: 150,
        width: 430,
        height: 76,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 52
        }
    },
    {
        id: 'node_position',
        kind: 'text',
        field: 'position',
        sample: 'Chief Executive Officer',
        x: 74,
        y: 226,
        width: 430,
        height: 46,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 24,
            fontWeight: '500',
            fill: '#1E293B'
        }
    },
    {
        id: 'node_company',
        kind: 'text',
        field: 'company',
        sample: 'Nege LLC',
        x: 74,
        y: 276,
        width: 430,
        height: 44,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 28,
            fontWeight: '700',
            fill: '#0F172A'
        }
    },
    {
        id: 'node_phone',
        kind: 'text',
        field: 'phone',
        sample: '+976 9911-2233',
        x: 74,
        y: 350,
        width: 370,
        height: 34,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 22,
            fontWeight: '400'
        }
    },
    {
        id: 'node_email',
        kind: 'text',
        field: 'email',
        sample: 'john@example.com',
        x: 74,
        y: 392,
        width: 370,
        height: 34,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 20,
            fontWeight: '400'
        }
    },
    {
        id: 'node_web',
        kind: 'text',
        field: 'web',
        sample: 'www.example.com',
        x: 74,
        y: 432,
        width: 370,
        height: 34,
        rotation: 0,
        style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 20,
            fontWeight: '400'
        }
    },
    {
        id: 'node_logo',
        kind: 'image',
        field: 'logo',
        sample: 'LOGO',
        x: 690,
        y: 116,
        width: 280,
        height: 160,
        rotation: 0,
        style: {
            ...DEFAULT_IMAGE_STYLE
        }
    }
];

const clampNumber = (value, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
};

const toFixed3 = (value) => {
    const rounded = Math.round(Number(value) * 1000) / 1000;
    return Number.isFinite(rounded) ? rounded : 0;
};

const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseStyleValue = (styleText, key) => {
    const source = String(styleText || '');
    const pattern = new RegExp(`${key}\\s*:\\s*([^;]+)`, 'i');
    const match = source.match(pattern);
    return match ? match[1].trim() : '';
};

const parseSvgNumber = (value) => {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseColorFromElement = (element) => {
    const fillAttr = element.getAttribute('fill');
    if (fillAttr) return fillAttr;
    const style = element.getAttribute('style') || '';
    return parseStyleValue(style, 'fill') || '';
};

const parseFontSizeFromElement = (element) => {
    const attrSize = parseSvgNumber(element.getAttribute('font-size'));
    if (attrSize) return attrSize;
    const style = element.getAttribute('style') || '';
    const styleSize = parseSvgNumber(parseStyleValue(style, 'font-size'));
    return styleSize || null;
};

const parseFontWeightFromElement = (element) => {
    const weight = element.getAttribute('font-weight');
    if (weight) return weight;
    const style = element.getAttribute('style') || '';
    return parseStyleValue(style, 'font-weight') || '';
};

const parseFontFamilyFromElement = (element) => {
    const family = element.getAttribute('font-family');
    if (family) return family;
    const style = element.getAttribute('style') || '';
    return parseStyleValue(style, 'font-family') || '';
};

const parseLetterSpacingFromElement = (element) => {
    const spacing = parseSvgNumber(element.getAttribute('letter-spacing'));
    if (Number.isFinite(spacing)) return spacing;
    const style = element.getAttribute('style') || '';
    const fromStyle = parseSvgNumber(parseStyleValue(style, 'letter-spacing'));
    return Number.isFinite(fromStyle) ? fromStyle : 0;
};

const toFieldKey = (value) => {
    const cleaned = String(value || '')
        .replace(/[{}]/g, ' ')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/);
    return parts[0].toLowerCase()
        + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
};

const makeId = () => `node_${Math.random().toString(36).slice(2, 10)}`;

const ensureUniqueFieldName = (rawField, usedNames, prefix = 'field') => {
    const base = toFieldKey(rawField) || prefix;
    if (!usedNames.has(base)) {
        usedNames.add(base);
        return base;
    }
    let index = 2;
    while (usedNames.has(`${base}${index}`)) {
        index += 1;
    }
    const unique = `${base}${index}`;
    usedNames.add(unique);
    return unique;
};

const normalizeNode = (node, index, usedNames) => {
    const kind = node?.kind === 'image' ? 'image' : 'text';
    const fieldPrefix = kind === 'image' ? 'image' : 'field';
    const field = ensureUniqueFieldName(node?.field, usedNames, fieldPrefix);
    const shared = {
        id: String(node?.id || makeId()),
        kind,
        field,
        sample: String(node?.sample || (kind === 'image' ? field.toUpperCase() : `{{${field}}}`)),
        x: clampNumber(node?.x, -10000, 10000),
        y: clampNumber(node?.y, -10000, 10000),
        width: clampNumber(node?.width, 24, 5000),
        height: clampNumber(node?.height, 18, 5000),
        rotation: clampNumber(node?.rotation, -360, 360)
    };

    if (kind === 'image') {
        return {
            ...shared,
            style: {
                ...DEFAULT_IMAGE_STYLE,
                ...(node?.style || {})
            }
        };
    }

    return {
        ...shared,
        style: {
            ...DEFAULT_TEXT_STYLE,
            ...(node?.style || {}),
            fontSize: clampNumber(node?.style?.fontSize ?? node?.fontSize, 6, 300),
            letterSpacing: clampNumber(node?.style?.letterSpacing ?? 0, -10, 100),
            align: ['left', 'center', 'right'].includes(node?.style?.align) ? node.style.align : 'left'
        }
    };
};

export const toCanvasFieldKey = toFieldKey;

export const createDefaultCanvasTemplate = () => {
    const usedNames = new Set();
    return {
        version: 1,
        width: DEFAULT_CARD_WIDTH,
        height: DEFAULT_CARD_HEIGHT,
        background: '#FFFFFF',
        safeMargin: DEFAULT_SAFE_MARGIN,
        nodes: DEFAULT_NODES.map((node, index) => normalizeNode(node, index, usedNames))
    };
};

export const normalizeCanvasTemplate = (rawTemplate) => {
    if (!rawTemplate || typeof rawTemplate !== 'object') {
        return createDefaultCanvasTemplate();
    }
    const width = clampNumber(rawTemplate.width, 240, 8000);
    const height = clampNumber(rawTemplate.height, 140, 8000);
    const safeMargin = clampNumber(rawTemplate.safeMargin, 0, Math.min(width, height) / 2);
    const usedNames = new Set();
    const hasExplicitNodes = Array.isArray(rawTemplate.nodes);
    const nodes = hasExplicitNodes
        ? rawTemplate.nodes.map((node, index) => normalizeNode(node, index, usedNames))
        : createDefaultCanvasTemplate().nodes;

    return {
        version: Number(rawTemplate.version) || 1,
        width,
        height,
        background: String(rawTemplate.background || '#FFFFFF'),
        safeMargin,
        nodes
    };
};

export const getUsedCanvasFieldNames = (canvasTemplate, excludeNodeId = '') => {
    const used = new Set();
    (canvasTemplate?.nodes || []).forEach((node) => {
        if (!node?.field) return;
        if (excludeNodeId && node.id === excludeNodeId) return;
        used.add(node.field);
    });
    return used;
};

export const ensureUniqueCanvasFieldName = (rawField, canvasTemplate, excludeNodeId = '', prefix = 'field') => {
    const used = getUsedCanvasFieldNames(canvasTemplate, excludeNodeId);
    return ensureUniqueFieldName(rawField, used, prefix);
};

export const createCanvasNode = (kind, canvasTemplate, patch = {}) => {
    const prefix = kind === 'image' ? 'image' : 'field';
    const field = ensureUniqueCanvasFieldName(
        patch.field || (kind === 'image' ? 'logo' : `${prefix}${(canvasTemplate?.nodes?.length || 0) + 1}`),
        canvasTemplate,
        '',
        prefix
    );
    const base = {
        id: makeId(),
        kind: kind === 'image' ? 'image' : 'text',
        field,
        sample: kind === 'image' ? 'LOGO' : `{{${field}}}`,
        x: 80,
        y: 80,
        width: kind === 'image' ? 180 : 280,
        height: kind === 'image' ? 110 : 48,
        rotation: 0
    };

    if (kind === 'image') {
        return normalizeNode(
            {
                ...base,
                ...patch,
                style: {
                    ...DEFAULT_IMAGE_STYLE,
                    ...(patch.style || {})
                }
            },
            0,
            new Set()
        );
    }

    return normalizeNode(
        {
            ...base,
            ...patch,
            style: {
                ...DEFAULT_TEXT_STYLE,
                ...(patch.style || {})
            }
        },
        0,
        new Set()
    );
};

const buildRotationTransform = (node) => {
    const angle = Number(node.rotation || 0);
    if (!Number.isFinite(angle) || Math.abs(angle) < 0.001) return '';
    const cx = toFixed3(node.x + (node.width / 2));
    const cy = toFixed3(node.y + (node.height / 2));
    return ` transform="rotate(${toFixed3(angle)} ${cx} ${cy})"`;
};

const getTextAnchor = (align) => {
    if (align === 'center') return 'middle';
    if (align === 'right') return 'end';
    return 'start';
};

const getAlignedX = (node, align) => {
    if (align === 'center') return node.x + (node.width / 2);
    if (align === 'right') return node.x + node.width;
    return node.x;
};

const estimateCharWidth = (char, fontSize) => {
    if (char === ' ') return fontSize * 0.33;
    if (/[ilI1.,:;!|'"`]/.test(char)) return fontSize * 0.31;
    if (/[MW@#%&]/.test(char)) return fontSize * 0.82;
    return fontSize * 0.58;
};

const estimateTextWidth = (text, fontSize, letterSpacing = 0) => {
    const source = String(text || '');
    if (!source) return 0;
    let width = 0;
    for (const char of source) {
        width += estimateCharWidth(char, fontSize);
    }
    if (source.length > 1) {
        width += letterSpacing * (source.length - 1);
    }
    return width;
};

const trimEndPunctuation = (text) => String(text || '').replace(/\s+$/g, '');

const truncateWithEllipsis = (text, maxWidth, fontSize, letterSpacing = 0) => {
    const source = trimEndPunctuation(text);
    if (!source) return '';
    if (estimateTextWidth(source, fontSize, letterSpacing) <= maxWidth) {
        return source;
    }
    const ellipsis = '...';
    const ellipsisWidth = estimateTextWidth(ellipsis, fontSize, letterSpacing);
    if (ellipsisWidth >= maxWidth) return '.';

    let current = source;
    while (current && (estimateTextWidth(current, fontSize, letterSpacing) + ellipsisWidth) > maxWidth) {
        current = current.slice(0, -1);
    }
    return `${trimEndPunctuation(current)}${ellipsis}`;
};

const splitLongToken = (token, maxWidth, fontSize, letterSpacing = 0) => {
    const chunks = [];
    let current = '';
    for (const char of String(token || '')) {
        const candidate = current + char;
        if (!current || estimateTextWidth(candidate, fontSize, letterSpacing) <= maxWidth) {
            current = candidate;
            continue;
        }
        chunks.push(current);
        current = char;
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [''];
};

const wrapParagraphToLines = (paragraph, maxWidth, fontSize, letterSpacing = 0) => {
    const normalized = String(paragraph || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return [''];
    const tokens = normalized.split(' ');
    const lines = [];
    let current = '';

    for (const token of tokens) {
        const tokenParts = estimateTextWidth(token, fontSize, letterSpacing) > maxWidth
            ? splitLongToken(token, maxWidth, fontSize, letterSpacing)
            : [token];

        for (const part of tokenParts) {
            if (!current) {
                current = part;
                continue;
            }
            const candidate = `${current} ${part}`;
            if (estimateTextWidth(candidate, fontSize, letterSpacing) <= maxWidth) {
                current = candidate;
            } else {
                lines.push(current);
                current = part;
            }
        }
    }

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
};

const wrapTextToLines = (text, { maxWidth, maxLines, fontSize, letterSpacing = 0 }) => {
    if (!maxWidth || maxWidth <= 0) return [String(text || '')];
    const parsedMaxLines = Number(maxLines);
    const hasLineLimit = Number.isFinite(parsedMaxLines) && parsedMaxLines > 0;
    const safeMaxLines = hasLineLimit ? Math.max(1, Math.floor(parsedMaxLines)) : null;
    const paragraphs = String(text || '').split(/\r?\n/);
    const lines = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
        const paragraphLines = wrapParagraphToLines(paragraph, maxWidth, fontSize, letterSpacing);
        paragraphLines.forEach((line) => lines.push(line));
        if (paragraphIndex < paragraphs.length - 1 && (!hasLineLimit || lines.length < safeMaxLines)) {
            lines.push('');
        }
    });

    if (!hasLineLimit || lines.length <= safeMaxLines) return lines;
    const trimmed = lines.slice(0, safeMaxLines);
    trimmed[safeMaxLines - 1] = truncateWithEllipsis(trimmed[safeMaxLines - 1], maxWidth, fontSize, letterSpacing);
    return trimmed;
};

export const canvasTemplateToSvgTemplate = (rawTemplate) => {
    const template = normalizeCanvasTemplate(rawTemplate);
    const fields = [];
    const report = [];
    const sourceSamples = {};
    const fieldKinds = {};
    const warnings = [];

    if (!Array.isArray(template.nodes) || template.nodes.length === 0) {
        warnings.push('Canvas has no nodes. Add at least one text field.');
    }

    const body = template.nodes.map((node) => {
        const fieldName = ensureUniqueFieldName(node.field, new Set(fields), node.kind === 'image' ? 'image' : 'field');
        if (!fields.includes(fieldName)) fields.push(fieldName);
        sourceSamples[fieldName] = node.sample || '';
        fieldKinds[fieldName] = node.kind;

        if (node.kind === 'image') {
            report.push({
                type: 'image',
                sample: node.sample || `image:${fieldName}`,
                field: fieldName,
                confidence: 1,
                reason: 'Canvas mapped image placeholder'
            });
            return `<image x="${toFixed3(node.x)}" y="${toFixed3(node.y)}" width="${toFixed3(node.width)}" height="${toFixed3(node.height)}" href="{{${escapeXml(fieldName)}}}" xlink:href="{{${escapeXml(fieldName)}}}" preserveAspectRatio="none"${buildRotationTransform(node)} />`;
        }

        const textAlign = node.style?.align || 'left';
        const textX = getAlignedX(node, textAlign);
        const textY = node.y;
        report.push({
            type: 'text',
            sample: node.sample || `{{${fieldName}}}`,
            field: fieldName,
            confidence: 1,
            reason: 'Canvas mapped text placeholder'
        });

        const fontSize = toFixed3(node.style?.fontSize || DEFAULT_TEXT_STYLE.fontSize);
        const lineHeight = toFixed3((node.style?.fontSize || DEFAULT_TEXT_STYLE.fontSize) * 1.22);
        return `<text x="${toFixed3(textX)}" y="${toFixed3(textY)}" font-family="${escapeXml(node.style?.fontFamily || DEFAULT_TEXT_STYLE.fontFamily)}" font-size="${fontSize}" font-weight="${escapeXml(node.style?.fontWeight || DEFAULT_TEXT_STYLE.fontWeight)}" fill="${escapeXml(node.style?.fill || DEFAULT_TEXT_STYLE.fill)}" text-anchor="${escapeXml(getTextAnchor(textAlign))}" letter-spacing="${toFixed3(node.style?.letterSpacing || 0)}" dominant-baseline="hanging" data-bc-field="${escapeXml(fieldName)}" data-bc-width="${toFixed3(node.width)}" data-bc-height="${toFixed3(node.height)}" data-bc-line-height="${lineHeight}"${buildRotationTransform(node)}>{{${escapeXml(fieldName)}}}</text>`;
    });

    const root = [
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${toFixed3(template.width)}" height="${toFixed3(template.height)}" viewBox="0 0 ${toFixed3(template.width)} ${toFixed3(template.height)}">`,
        `<rect x="0" y="0" width="${toFixed3(template.width)}" height="${toFixed3(template.height)}" fill="${escapeXml(template.background || '#FFFFFF')}" />`,
        ...body,
        '</svg>'
    ].join('');

    const textFieldCount = fields.filter((field) => fieldKinds[field] !== 'image').length;
    if (textFieldCount === 0) {
        warnings.push('No text field detected. A business card normally needs at least one text field.');
    }

    return {
        svgContent: root,
        extractedFields: fields,
        sourceSamples,
        fieldKinds,
        report,
        warnings
    };
};

export const populateBusinessCardSvg = (svgContent, values = {}) => {
    const source = String(svgContent || '');
    if (!source.trim()) return '';

    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
        return source.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, fieldName) => {
            const key = String(fieldName || '').trim();
            const value = values[key];
            return value === null || value === undefined ? '' : String(value);
        });
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        return source.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, fieldName) => {
            const key = String(fieldName || '').trim();
            const value = values[key];
            return value === null || value === undefined ? '' : String(value);
        });
    }

    const getFieldValue = (field) => {
        const key = String(field || '').trim();
        const value = values[key];
        if (value === null || value === undefined) return '';
        return String(value);
    };

    const textNodes = Array.from(doc.querySelectorAll('text')).filter((node) => !node.closest('defs'));
    textNodes.forEach((node) => {
        const sourceText = node.textContent || '';
        const match = sourceText.match(FIELD_PLACEHOLDER_REGEX);
        if (!match) return;

        const fieldName = String(match[1] || '').trim();
        const valueText = getFieldValue(fieldName);
        const maxWidth = parseSvgNumber(node.getAttribute('data-bc-width'));
        const maxHeight = parseSvgNumber(node.getAttribute('data-bc-height'));
        const explicitLineHeight = parseSvgNumber(node.getAttribute('data-bc-line-height'));
        const fontSize = parseFontSizeFromElement(node) || DEFAULT_TEXT_STYLE.fontSize;
        const letterSpacing = parseLetterSpacingFromElement(node);
        const x = node.getAttribute('x') || '0';
        const y = parseSvgNumber(node.getAttribute('y')) || 0;

        const lineHeight = explicitLineHeight && explicitLineHeight > 0
            ? explicitLineHeight
            : (fontSize * 1.22);
        // If node height only fits ~1 line, keep wrapping enabled without forcing a 1-line clamp.
        const inferredMaxLines = maxHeight && maxHeight > 0
            ? Math.floor(maxHeight / lineHeight)
            : null;
        const maxLines = inferredMaxLines && inferredMaxLines > 1
            ? inferredMaxLines
            : null;

        const lines = maxWidth && maxWidth > 0
            ? wrapTextToLines(valueText, {
                maxWidth,
                maxLines,
                fontSize,
                letterSpacing
            })
            : [valueText];

        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }

        if (lines.length <= 1) {
            node.textContent = lines[0] || '';
            return;
        }

        lines.forEach((line, index) => {
            const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', x);
            tspan.setAttribute('y', String(toFixed3(y + (index * lineHeight))));
            tspan.textContent = line || '';
            node.appendChild(tspan);
        });
    });

    const imageNodes = Array.from(doc.querySelectorAll('image')).filter((node) => !node.closest('defs'));
    imageNodes.forEach((node) => {
        const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
        const match = href.match(FIELD_PLACEHOLDER_REGEX);
        if (!match) return;
        const fieldName = String(match[1] || '').trim();
        const value = getFieldValue(fieldName);
        node.setAttribute('href', value);
        node.setAttribute('xlink:href', value);
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
};

const extractPlaceholderField = (value) => {
    const match = String(value || '').match(FIELD_PLACEHOLDER_REGEX);
    return match ? toFieldKey(match[1]) : '';
};

const resolveCanvasSizeFromSvg = (svg) => {
    const widthAttr = parseSvgNumber(svg.getAttribute('width'));
    const heightAttr = parseSvgNumber(svg.getAttribute('height'));
    if (widthAttr && heightAttr) {
        return {
            width: clampNumber(widthAttr, 240, 8000),
            height: clampNumber(heightAttr, 140, 8000)
        };
    }
    const viewBox = String(svg.getAttribute('viewBox') || '').trim();
    const parts = viewBox.split(/[,\s]+/).map((item) => Number(item));
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] > 0 && parts[3] > 0) {
        return {
            width: clampNumber(parts[2], 240, 8000),
            height: clampNumber(parts[3], 140, 8000)
        };
    }
    return { width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT };
};

const parseSvgBackground = (svg, width, height) => {
    const rects = Array.from(svg.querySelectorAll('rect'));
    const fullRect = rects.find((rect) => {
        const rectWidth = parseSvgNumber(rect.getAttribute('width')) || 0;
        const rectHeight = parseSvgNumber(rect.getAttribute('height')) || 0;
        const x = parseSvgNumber(rect.getAttribute('x')) || 0;
        const y = parseSvgNumber(rect.getAttribute('y')) || 0;
        const coversWidth = rectWidth >= width * 0.98;
        const coversHeight = rectHeight >= height * 0.98;
        return coversWidth && coversHeight && Math.abs(x) < 1 && Math.abs(y) < 1;
    });
    if (!fullRect) return '#FFFFFF';
    const fill = parseColorFromElement(fullRect);
    return fill || '#FFFFFF';
};

export const svgTemplateToCanvasTemplate = (svgContent) => {
    if (!svgContent || !String(svgContent).trim()) {
        return createDefaultCanvasTemplate();
    }

    const parser = new DOMParser();
    const parsed = parser.parseFromString(String(svgContent), 'image/svg+xml');
    if (parsed.querySelector('parsererror')) {
        return createDefaultCanvasTemplate();
    }
    const svg = parsed.querySelector('svg');
    if (!svg) return createDefaultCanvasTemplate();

    const { width, height } = resolveCanvasSizeFromSvg(svg);
    const background = parseSvgBackground(svg, width, height);
    const nodes = [];
    const usedNames = new Set();

    const textNodes = Array.from(svg.querySelectorAll('text')).filter((node) => !node.closest('defs'));
    textNodes.forEach((node) => {
        const field = extractPlaceholderField(node.textContent || '');
        if (!field) return;

        const fontSize = parseFontSizeFromElement(node) || 24;
        const fontFamily = parseFontFamilyFromElement(node) || DEFAULT_TEXT_STYLE.fontFamily;
        const fontWeight = parseFontWeightFromElement(node) || DEFAULT_TEXT_STYLE.fontWeight;
        const fill = parseColorFromElement(node) || DEFAULT_TEXT_STYLE.fill;
        const letterSpacing = parseLetterSpacingFromElement(node);
        const anchor = String(node.getAttribute('text-anchor') || '').toLowerCase();
        const align = anchor === 'middle' ? 'center' : (anchor === 'end' ? 'right' : 'left');
        const x = parseSvgNumber(node.getAttribute('x')) || 0;
        const y = parseSvgNumber(node.getAttribute('y')) || 0;
        const widthEstimate = Math.max(120, fontSize * 8);
        const nodeWidth = Math.min(width - 20, widthEstimate);
        const startX = align === 'center'
            ? x - (nodeWidth / 2)
            : (align === 'right' ? x - nodeWidth : x);
        const canonicalField = ensureUniqueFieldName(field, usedNames, 'field');

        nodes.push({
            id: makeId(),
            kind: 'text',
            field: canonicalField,
            sample: canonicalField,
            x: clampNumber(startX, -10000, 10000),
            y: clampNumber(y, -10000, 10000),
            width: clampNumber(nodeWidth, 24, 5000),
            height: clampNumber(fontSize * 1.45, 18, 5000),
            rotation: clampNumber(parseSvgNumber(node.getAttribute('transform')?.match(/rotate\(([^)]+)\)/)?.[1]) || 0, -360, 360),
            style: {
                ...DEFAULT_TEXT_STYLE,
                fontFamily,
                fontSize: clampNumber(fontSize, 6, 300),
                fontWeight,
                fill,
                align,
                letterSpacing: clampNumber(letterSpacing, -10, 100)
            }
        });
    });

    const imageNodes = Array.from(svg.querySelectorAll('image')).filter((node) => !node.closest('defs'));
    imageNodes.forEach((node) => {
        const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
        const field = extractPlaceholderField(href);
        if (!field) return;
        const canonicalField = ensureUniqueFieldName(field, usedNames, 'image');
        nodes.push({
            id: makeId(),
            kind: 'image',
            field: canonicalField,
            sample: canonicalField.toUpperCase(),
            x: clampNumber(parseSvgNumber(node.getAttribute('x')) || 0, -10000, 10000),
            y: clampNumber(parseSvgNumber(node.getAttribute('y')) || 0, -10000, 10000),
            width: clampNumber(parseSvgNumber(node.getAttribute('width')) || 140, 24, 5000),
            height: clampNumber(parseSvgNumber(node.getAttribute('height')) || 90, 18, 5000),
            rotation: clampNumber(parseSvgNumber(node.getAttribute('transform')?.match(/rotate\(([^)]+)\)/)?.[1]) || 0, -360, 360),
            style: {
                ...DEFAULT_IMAGE_STYLE
            }
        });
    });

    if (nodes.length === 0) {
        return createDefaultCanvasTemplate();
    }

    return normalizeCanvasTemplate({
        version: 1,
        width,
        height,
        background,
        safeMargin: DEFAULT_SAFE_MARGIN,
        nodes
    });
};
