import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { Group, Layer, Line, Rect, Stage, Text as KonvaText, Transformer } from 'react-konva';
import {
    createCanvasNode,
    ensureUniqueCanvasFieldName,
    normalizeCanvasTemplate
} from '../../lib/businessCardCanvas';

const FONT_FAMILIES = [
    'Arial, sans-serif',
    'Helvetica Neue, sans-serif',
    'Montserrat, sans-serif',
    'Georgia, serif',
    'Times New Roman, serif',
    'Courier New, monospace'
];

const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800'];
const PX_PER_MM = 300 / 25.4;
const CARD_SIZE_PRESETS = [
    { id: 'us_3_5x2', label: 'US (3.5 x 2 inch)', widthMm: 88.9, heightMm: 50.8 },
    { id: 'iso_85x55', label: 'ISO / EU (85 x 55 mm)', widthMm: 85, heightMm: 55 },
    { id: 'asia_90x54', label: 'Asia (90 x 54 mm)', widthMm: 90, heightMm: 54 },
    { id: 'classic_90x50', label: 'Classic (90 x 50 mm)', widthMm: 90, heightMm: 50 }
];

const MIN_CANVAS_WIDTH = 240;
const MAX_CANVAS_WIDTH = 8000;
const MIN_CANVAS_HEIGHT = 140;
const MAX_CANVAS_HEIGHT = 8000;
const MIN_NODE_XY = -10000;
const MAX_NODE_XY = 10000;
const MIN_NODE_WIDTH = 24;
const MAX_NODE_WIDTH = 5000;
const MIN_NODE_HEIGHT = 18;
const MAX_NODE_HEIGHT = 5000;

const clamp = (value, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
};

const round = (value) => Math.round(Number(value || 0));
const mmToPx = (mmValue) => Number(mmValue || 0) * PX_PER_MM;
const pxToMm = (pxValue) => Math.round((Number(pxValue || 0) / PX_PER_MM) * 100) / 100;
const approximatelyEqual = (a, b, tolerance = 1.5) => Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
const getPresetPxSize = (preset) => ({
    width: mmToPx(preset.widthMm),
    height: mmToPx(preset.heightMm)
});
const findMatchingCardSizePreset = (widthPx, heightPx) => {
    for (const preset of CARD_SIZE_PRESETS) {
        const presetSize = getPresetPxSize(preset);
        if (approximatelyEqual(widthPx, presetSize.width) && approximatelyEqual(heightPx, presetSize.height)) {
            return preset;
        }
    }
    return null;
};

const BusinessCardCanvasDesigner = ({
    value,
    onChange,
    onSyncRequest,
    syncPending = false,
    cardSizeLocked = false
}) => {
    const canvas = useMemo(() => normalizeCanvasTemplate(value), [value]);
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [containerWidth, setContainerWidth] = useState(760);
    const [inspectorTab, setInspectorTab] = useState('canvas');
    const [widthDraftMm, setWidthDraftMm] = useState('');
    const [heightDraftMm, setHeightDraftMm] = useState('');
    const [isEditingWidthMm, setIsEditingWidthMm] = useState(false);
    const [isEditingHeightMm, setIsEditingHeightMm] = useState(false);
    const containerRef = useRef(null);
    const shapeRefs = useRef({});
    const transformerRef = useRef(null);

    const selectedNode = canvas.nodes.find((node) => node.id === selectedNodeId) || null;
    const activeSelectedNodeId = selectedNode ? selectedNodeId : '';
    const activeInspectorTab = selectedNode
        ? inspectorTab
        : (inspectorTab === 'selection' ? 'canvas' : inspectorTab);
    const scale = containerWidth > 0 ? containerWidth / canvas.width : 1;
    const stageHeight = Math.max(220, canvas.height * scale);
    const matchedCardSizePreset = useMemo(
        () => findMatchingCardSizePreset(canvas.width, canvas.height),
        [canvas.width, canvas.height]
    );
    const activeCardSizePresetId = matchedCardSizePreset?.id || 'custom';

    const emit = (nextTemplate) => {
        onChange?.(normalizeCanvasTemplate(nextTemplate));
    };

    const patchCanvas = (patch) => {
        emit({
            ...canvas,
            ...patch
        });
    };

    const applyCardSizePreset = (presetId) => {
        if (cardSizeLocked) return;
        const preset = CARD_SIZE_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        const presetSize = getPresetPxSize(preset);
        patchCanvas({
            width: clamp(presetSize.width, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH),
            height: clamp(presetSize.height, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT)
        });
    };

    const patchNode = (nodeId, patch) => {
        patchNodes(nodeId, () => patch);
    };

    const commitSelectedDimensionMm = (dimension) => {
        if (!selectedNode) return;
        const isWidth = dimension === 'width';
        const draftValue = isWidth ? widthDraftMm : heightDraftMm;
        const fallbackPxValue = isWidth ? selectedNode.width : selectedNode.height;
        const minPx = isWidth ? MIN_NODE_WIDTH : MIN_NODE_HEIGHT;
        const maxPx = isWidth ? MAX_NODE_WIDTH : MAX_NODE_HEIGHT;

        const parsedMm = Number(String(draftValue || '').replace(',', '.'));
        const nextPxValue = Number.isFinite(parsedMm)
            ? clamp(mmToPx(parsedMm), minPx, maxPx)
            : fallbackPxValue;

        patchNode(selectedNode.id, { [dimension]: nextPxValue });
        if (isWidth) {
            setWidthDraftMm(String(pxToMm(nextPxValue)));
            return;
        }
        setHeightDraftMm(String(pxToMm(nextPxValue)));
    };

    const patchNodes = (nodeId, updater) => {
        const nextNodes = canvas.nodes.map((node) => {
            if (node.id !== nodeId) return node;
            const patch = typeof updater === 'function' ? updater(node) : updater;
            return {
                ...node,
                ...patch,
                style: {
                    ...(node.style || {}),
                    ...(patch?.style || {})
                }
            };
        });
        emit({
            ...canvas,
            nodes: nextNodes
        });
    };

    const addTextNode = () => {
        const offset = (canvas.nodes.length % 8) * 14;
        const node = createCanvasNode('text', canvas, {
            field: 'field',
            sample: 'New text',
            x: 80 + offset,
            y: 80 + offset,
            width: 280,
            height: 52,
            style: {
                fontSize: 28
            }
        });
        emit({
            ...canvas,
            nodes: [...canvas.nodes, node]
        });
        setSelectedNodeId(node.id);
    };

    const addImageNode = () => {
        const offset = (canvas.nodes.length % 8) * 14;
        const node = createCanvasNode('image', canvas, {
            field: 'logo',
            sample: 'LOGO',
            x: 640 + offset,
            y: 96 + offset,
            width: 240,
            height: 150
        });
        emit({
            ...canvas,
            nodes: [...canvas.nodes, node]
        });
        setSelectedNodeId(node.id);
    };

    const duplicateSelected = () => {
        if (!selectedNode) return;
        const kind = selectedNode.kind === 'image' ? 'image' : 'text';
        const duplicate = createCanvasNode(kind, canvas, {
            ...selectedNode,
            id: undefined,
            field: selectedNode.field,
            x: selectedNode.x + 16,
            y: selectedNode.y + 16
        });
        emit({
            ...canvas,
            nodes: [...canvas.nodes, duplicate]
        });
        setSelectedNodeId(duplicate.id);
    };

    const deleteSelected = () => {
        if (!selectedNode) return;
        emit({
            ...canvas,
            nodes: canvas.nodes.filter((node) => node.id !== selectedNode.id)
        });
        setSelectedNodeId('');
    };

    const moveSelected = (direction) => {
        if (!selectedNode) return;
        const currentIndex = canvas.nodes.findIndex((node) => node.id === selectedNode.id);
        if (currentIndex < 0) return;
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= canvas.nodes.length) return;
        const nextNodes = [...canvas.nodes];
        const [moved] = nextNodes.splice(currentIndex, 1);
        nextNodes.splice(nextIndex, 0, moved);
        emit({
            ...canvas,
            nodes: nextNodes
        });
    };

    useEffect(() => {
        if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
        const element = containerRef.current;
        const observer = new ResizeObserver((entries) => {
            const width = entries?.[0]?.contentRect?.width || 760;
            setContainerWidth(Math.max(320, width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!selectedNode) {
            setWidthDraftMm('');
            setHeightDraftMm('');
            return;
        }
        if (!isEditingWidthMm) {
            setWidthDraftMm(String(pxToMm(selectedNode.width)));
        }
        if (!isEditingHeightMm) {
            setHeightDraftMm(String(pxToMm(selectedNode.height)));
        }
    }, [
        selectedNodeId,
        selectedNode?.width,
        selectedNode?.height,
        isEditingWidthMm,
        isEditingHeightMm
    ]);

    useEffect(() => {
        if (!transformerRef.current) return;
        if (!activeSelectedNodeId) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer()?.batchDraw();
            return;
        }
        const targetNode = shapeRefs.current[activeSelectedNodeId];
        if (!targetNode) return;
        transformerRef.current.nodes([targetNode]);
        transformerRef.current.getLayer()?.batchDraw();
    }, [activeSelectedNodeId, canvas.nodes]);

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-2">
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-xs btn-secondary" onClick={addTextNode}>
                        <Plus size={14} className="mr-1" /> Add Text
                    </button>
                    <button type="button" className="btn btn-xs btn-secondary" onClick={addImageNode}>
                        <ImageIcon size={14} className="mr-1" /> Add Image
                    </button>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={duplicateSelected} disabled={!selectedNode}>
                        <Copy size={14} className="mr-1" /> Duplicate
                    </button>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={deleteSelected} disabled={!selectedNode}>
                        <Trash2 size={14} className="mr-1" /> Delete
                    </button>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => moveSelected(1)} disabled={!selectedNode}>
                        <ArrowUp size={14} className="mr-1" /> Bring Front
                    </button>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => moveSelected(-1)} disabled={!selectedNode}>
                        <ArrowDown size={14} className="mr-1" /> Send Back
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="hidden md:inline text-[11px] text-slate-500">
                            {selectedNode ? `Selected: ${selectedNode.kind === 'image' ? 'image' : 'text'} / ${selectedNode.field}` : 'No node selected'}
                        </span>
                        <button type="button" className="btn btn-xs btn-primary" onClick={onSyncRequest} disabled={syncPending}>
                            {syncPending ? 'Syncing...' : 'Sync To SVG'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
                    <div ref={containerRef} className="w-full rounded-xl overflow-hidden border border-slate-600 bg-slate-800">
                        <Stage
                            width={containerWidth}
                            height={stageHeight}
                            onMouseDown={(event) => {
                                const clickedOnEmpty = event.target === event.target.getStage()
                                    || event.target?.name?.() === 'canvas-background';
                                if (clickedOnEmpty) setSelectedNodeId('');
                            }}
                        >
                            <Layer scaleX={scale} scaleY={scale}>
                                <Rect
                                    name="canvas-background"
                                    x={0}
                                    y={0}
                                    width={canvas.width}
                                    height={canvas.height}
                                    fill={canvas.background || '#FFFFFF'}
                                    stroke="#CBD5E1"
                                    strokeWidth={1}
                                />
                                <Line
                                    points={[
                                        canvas.safeMargin,
                                        canvas.safeMargin,
                                        canvas.width - canvas.safeMargin,
                                        canvas.safeMargin,
                                        canvas.width - canvas.safeMargin,
                                        canvas.height - canvas.safeMargin,
                                        canvas.safeMargin,
                                        canvas.height - canvas.safeMargin,
                                        canvas.safeMargin,
                                        canvas.safeMargin
                                    ]}
                                    stroke="#CBD5E1"
                                    dash={[8, 6]}
                                    listening={false}
                                />

                                {canvas.nodes.map((node) => {
                                    const isSelected = activeSelectedNodeId === node.id;
                                    const imageStyle = node.style || {};
                                    const textStyle = node.style || {};
                                    return (
                                        <Group
                                            key={node.id}
                                            x={node.x}
                                            y={node.y}
                                            rotation={node.rotation || 0}
                                            draggable
                                            onClick={() => setSelectedNodeId(node.id)}
                                            onTap={() => setSelectedNodeId(node.id)}
                                            onDragEnd={(event) => {
                                                patchNode(node.id, {
                                                    x: round(event.target.x()),
                                                    y: round(event.target.y())
                                                });
                                            }}
                                            onTransformEnd={(event) => {
                                                const target = event.target;
                                                const scaleX = target.scaleX();
                                                const scaleY = target.scaleY();
                                                const nextWidth = clamp(node.width * scaleX, MIN_NODE_WIDTH, canvas.width * 3);
                                                const nextHeight = clamp(node.height * scaleY, MIN_NODE_HEIGHT, canvas.height * 3);
                                                target.scaleX(1);
                                                target.scaleY(1);
                                                if (node.kind === 'image') {
                                                    patchNode(node.id, {
                                                        x: round(target.x()),
                                                        y: round(target.y()),
                                                        width: round(nextWidth),
                                                        height: round(nextHeight),
                                                        rotation: round(target.rotation())
                                                    });
                                                    return;
                                                }
                                                patchNode(node.id, {
                                                    x: round(target.x()),
                                                    y: round(target.y()),
                                                    width: round(nextWidth),
                                                    height: round(nextHeight),
                                                    rotation: round(target.rotation()),
                                                    style: {
                                                        fontSize: round(clamp((node.style?.fontSize || 24) * scaleY, 6, 300))
                                                    }
                                                });
                                            }}
                                            ref={(instance) => {
                                                if (instance) {
                                                    shapeRefs.current[node.id] = instance;
                                                } else {
                                                    delete shapeRefs.current[node.id];
                                                }
                                            }}
                                        >
                                            {node.kind === 'image' ? (
                                                <>
                                                    <Rect
                                                        x={0}
                                                        y={0}
                                                        width={node.width}
                                                        height={node.height}
                                                        fill={imageStyle.fill || '#E2E8F0'}
                                                        stroke={isSelected ? '#2563EB' : (imageStyle.stroke || '#94A3B8')}
                                                        strokeWidth={isSelected ? 2 : (imageStyle.strokeWidth || 1)}
                                                        cornerRadius={6}
                                                    />
                                                    <KonvaText
                                                        x={0}
                                                        y={0}
                                                        width={node.width}
                                                        height={node.height}
                                                        text={node.sample || node.field}
                                                        align="center"
                                                        verticalAlign="middle"
                                                        fontSize={18}
                                                        fill={imageStyle.labelColor || '#334155'}
                                                        listening={false}
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <Rect
                                                        x={0}
                                                        y={0}
                                                        width={node.width}
                                                        height={node.height}
                                                        fillEnabled={false}
                                                        stroke={isSelected ? '#2563EB' : '#CBD5E1'}
                                                        strokeWidth={1}
                                                        dash={[6, 4]}
                                                    />
                                                    <KonvaText
                                                        x={0}
                                                        y={0}
                                                        width={node.width}
                                                        height={node.height}
                                                        text={node.sample || `{{${node.field}}}`}
                                                        fontFamily={textStyle.fontFamily || 'Arial, sans-serif'}
                                                        fontSize={textStyle.fontSize || 24}
                                                        fontStyle={String(textStyle.fontWeight || '400') >= '700' ? 'bold' : 'normal'}
                                                        fill={textStyle.fill || '#111827'}
                                                        align={textStyle.align || 'left'}
                                                        letterSpacing={textStyle.letterSpacing || 0}
                                                        verticalAlign="top"
                                                        padding={0}
                                                        listening={false}
                                                    />
                                                </>
                                            )}
                                        </Group>
                                    );
                                })}
                                <Transformer
                                    ref={transformerRef}
                                    rotateEnabled
                                    enabledAnchors={[
                                        'top-left',
                                        'top-right',
                                        'bottom-left',
                                        'bottom-right',
                                        'middle-left',
                                        'middle-right',
                                        'top-center',
                                        'bottom-center'
                                    ]}
                                    boundBoxFunc={(oldBox, newBox) => {
                                        if (newBox.width < MIN_NODE_WIDTH || newBox.height < MIN_NODE_HEIGHT) return oldBox;
                                        return newBox;
                                    }}
                                />
                            </Layer>
                        </Stage>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>Drag nodes. Resize/rotate with handles. Dashed line = safe margin.</span>
                        <span>{pxToMm(canvas.width)} x {pxToMm(canvas.height)} mm</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 space-y-3">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 w-full">
                        <button
                            type="button"
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md ${activeInspectorTab === 'canvas' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-600'}`}
                            onClick={() => setInspectorTab('canvas')}
                        >
                            Canvas
                        </button>
                        <button
                            type="button"
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md ${activeInspectorTab === 'selection' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-600'} ${!selectedNode ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                                if (!selectedNode) return;
                                setInspectorTab('selection');
                            }}
                            disabled={!selectedNode}
                        >
                            Selected
                        </button>
                        <button
                            type="button"
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md ${activeInspectorTab === 'layers' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-600'}`}
                            onClick={() => setInspectorTab('layers')}
                        >
                            Layers
                        </button>
                    </div>

                    {activeInspectorTab === 'canvas' && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Canvas Settings</h3>
                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-500 block">
                                    {cardSizeLocked ? 'Card Size (shared)' : 'Card Size (standard)'}
                                    <select
                                        className={`input input-xs w-full mt-1 ${cardSizeLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        value={activeCardSizePresetId}
                                        onChange={(event) => applyCardSizePreset(event.target.value)}
                                        disabled={cardSizeLocked}
                                    >
                                        {CARD_SIZE_PRESETS.map((preset) => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.label}
                                            </option>
                                        ))}
                                        {activeCardSizePresetId === 'custom' && (
                                            <option value="custom">Custom size (from SVG)</option>
                                        )}
                                    </select>
                                </label>
                                <p className="text-[10px] text-slate-500">
                                    Current: {pxToMm(canvas.width)} x {pxToMm(canvas.height)} mm
                                </p>
                                {cardSizeLocked && (
                                    <p className="text-[10px] text-slate-500">
                                        Front side card size-тай автоматаар ижил байна.
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-[11px] text-slate-500">
                                    Background
                                    <input
                                        type="color"
                                        className="input input-xs w-full mt-1 p-1"
                                        value={canvas.background || '#FFFFFF'}
                                        onChange={(event) => patchCanvas({ background: event.target.value || '#FFFFFF' })}
                                    />
                                </label>
                                <label className="text-[11px] text-slate-500">
                                    Safe Margin (mm)
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input input-xs w-full mt-1"
                                        min={0}
                                        max={pxToMm(Math.min(canvas.width, canvas.height) / 2)}
                                        value={pxToMm(canvas.safeMargin)}
                                        onChange={(event) => patchCanvas({
                                            safeMargin: clamp(
                                                mmToPx(event.target.value),
                                                0,
                                                Math.min(canvas.width, canvas.height) / 2
                                            )
                                        })}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {activeInspectorTab === 'selection' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Selected Node</h3>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-outline text-rose-600 border-rose-200 hover:bg-rose-50"
                                    onClick={deleteSelected}
                                    disabled={!selectedNode}
                                >
                                    <Trash2 size={13} className="mr-1" /> Delete Selected
                                </button>
                            </div>
                            {!selectedNode ? (
                                <p className="text-[11px] text-slate-500">Select a node to edit its field and style settings.</p>
                            ) : (
                                <>
                                    <label className="text-[11px] text-slate-500 block">
                                        Field Name
                                        <input
                                            className="input input-xs w-full mt-1 font-mono"
                                            value={selectedNode.field}
                                            onChange={(event) => {
                                                const prefix = selectedNode.kind === 'image' ? 'image' : 'field';
                                                const unique = ensureUniqueCanvasFieldName(
                                                    event.target.value,
                                                    canvas,
                                                    selectedNode.id,
                                                    prefix
                                                );
                                                patchNode(selectedNode.id, { field: unique });
                                            }}
                                        />
                                    </label>
                                    <label className="text-[11px] text-slate-500 block">
                                        Sample / Label
                                        <input
                                            className="input input-xs w-full mt-1"
                                            value={selectedNode.sample || ''}
                                            onChange={(event) => patchNode(selectedNode.id, { sample: event.target.value })}
                                        />
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-[11px] text-slate-500">
                                            X (mm)
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input input-xs w-full mt-1"
                                                min={pxToMm(MIN_NODE_XY)}
                                                max={pxToMm(MAX_NODE_XY)}
                                                value={pxToMm(selectedNode.x)}
                                                onChange={(event) => patchNode(selectedNode.id, {
                                                    x: clamp(mmToPx(event.target.value), MIN_NODE_XY, MAX_NODE_XY)
                                                })}
                                            />
                                        </label>
                                        <label className="text-[11px] text-slate-500">
                                            Y (mm)
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input input-xs w-full mt-1"
                                                min={pxToMm(MIN_NODE_XY)}
                                                max={pxToMm(MAX_NODE_XY)}
                                                value={pxToMm(selectedNode.y)}
                                                onChange={(event) => patchNode(selectedNode.id, {
                                                    y: clamp(mmToPx(event.target.value), MIN_NODE_XY, MAX_NODE_XY)
                                                })}
                                            />
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-[11px] text-slate-500">
                                            Width (mm)
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input input-xs w-full mt-1"
                                                min={pxToMm(MIN_NODE_WIDTH)}
                                                max={pxToMm(MAX_NODE_WIDTH)}
                                                value={widthDraftMm}
                                                onFocus={() => setIsEditingWidthMm(true)}
                                                onChange={(event) => setWidthDraftMm(event.target.value)}
                                                onBlur={() => {
                                                    commitSelectedDimensionMm('width');
                                                    setIsEditingWidthMm(false);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        event.currentTarget.blur();
                                                    }
                                                }}
                                            />
                                        </label>
                                        <label className="text-[11px] text-slate-500">
                                            Height (mm)
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input input-xs w-full mt-1"
                                                min={pxToMm(MIN_NODE_HEIGHT)}
                                                max={pxToMm(MAX_NODE_HEIGHT)}
                                                value={heightDraftMm}
                                                onFocus={() => setIsEditingHeightMm(true)}
                                                onChange={(event) => setHeightDraftMm(event.target.value)}
                                                onBlur={() => {
                                                    commitSelectedDimensionMm('height');
                                                    setIsEditingHeightMm(false);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        event.currentTarget.blur();
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <label className="text-[11px] text-slate-500 block">
                                        Rotation
                                        <input
                                            type="number"
                                            className="input input-xs w-full mt-1"
                                            min={-360}
                                            max={360}
                                            value={round(selectedNode.rotation || 0)}
                                            onChange={(event) => patchNode(selectedNode.id, { rotation: clamp(event.target.value, -360, 360) })}
                                        />
                                    </label>

                                    {selectedNode.kind === 'text' && (
                                        <div className="space-y-2 pt-1 border-t border-slate-200">
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="text-[11px] text-slate-500">
                                                    Font Size
                                                    <input
                                                        type="number"
                                                        className="input input-xs w-full mt-1"
                                                        min={6}
                                                        max={300}
                                                        value={round(selectedNode.style?.fontSize || 24)}
                                                        onChange={(event) => patchNode(selectedNode.id, {
                                                            style: { fontSize: clamp(event.target.value, 6, 300) }
                                                        })}
                                                    />
                                                </label>
                                                <label className="text-[11px] text-slate-500">
                                                    Weight
                                                    <select
                                                        className="input input-xs w-full mt-1"
                                                        value={String(selectedNode.style?.fontWeight || '400')}
                                                        onChange={(event) => patchNode(selectedNode.id, {
                                                            style: { fontWeight: event.target.value }
                                                        })}
                                                    >
                                                        {FONT_WEIGHTS.map((weight) => (
                                                            <option key={weight} value={weight}>{weight}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>
                                            <label className="text-[11px] text-slate-500 block">
                                                Font Family
                                                <select
                                                    className="input input-xs w-full mt-1"
                                                    value={selectedNode.style?.fontFamily || 'Arial, sans-serif'}
                                                    onChange={(event) => patchNode(selectedNode.id, {
                                                        style: { fontFamily: event.target.value }
                                                    })}
                                                >
                                                    {FONT_FAMILIES.map((family) => (
                                                        <option key={family} value={family}>{family}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <label className="text-[11px] text-slate-500">
                                                    Color
                                                    <input
                                                        type="color"
                                                        className="input input-xs w-full mt-1 p-1"
                                                        value={selectedNode.style?.fill || '#111827'}
                                                        onChange={(event) => patchNode(selectedNode.id, {
                                                            style: { fill: event.target.value }
                                                        })}
                                                    />
                                                </label>
                                                <label className="text-[11px] text-slate-500">
                                                    Align
                                                    <select
                                                        className="input input-xs w-full mt-1"
                                                        value={selectedNode.style?.align || 'left'}
                                                        onChange={(event) => patchNode(selectedNode.id, {
                                                            style: { align: event.target.value }
                                                        })}
                                                    >
                                                        <option value="left">left</option>
                                                        <option value="center">center</option>
                                                        <option value="right">right</option>
                                                    </select>
                                                </label>
                                            </div>
                                            <label className="text-[11px] text-slate-500 block">
                                                Letter Spacing
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    className="input input-xs w-full mt-1"
                                                    min={-10}
                                                    max={100}
                                                    value={selectedNode.style?.letterSpacing || 0}
                                                    onChange={(event) => patchNode(selectedNode.id, {
                                                        style: { letterSpacing: clamp(event.target.value, -10, 100) }
                                                    })}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeInspectorTab === 'layers' && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Layers</h3>
                            <p className="text-[11px] text-slate-500">
                                Top-most layers are displayed first.
                            </p>
                            <div className="max-h-72 overflow-auto space-y-1.5 pr-1">
                                {[...canvas.nodes].reverse().map((node) => (
                                    <button
                                        key={node.id}
                                        type="button"
                                        className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] border ${
                                            activeSelectedNodeId === node.id
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                        onClick={() => {
                                            setSelectedNodeId(node.id);
                                            setInspectorTab('selection');
                                        }}
                                    >
                                        <span className="font-medium">{node.kind === 'image' ? 'IMG' : 'TXT'}</span> - {node.field}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BusinessCardCanvasDesigner;
