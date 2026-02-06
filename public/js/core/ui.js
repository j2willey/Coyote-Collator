/**
 * Shared UI Rendering Logic
 * Generates HTML for scoring fields.
 */

export function generateFieldHTML(field, value = null) {
    const id = field.id;

    // 1. Textarea: Vertical Stack (Exception)
    if (field.type === 'textarea') {
        const isPenalty = field.kind === 'penalty';
        const penaltyStyle = isPenalty ? 'color: red !important; font-weight: bold;' : '';
        return `<div class="mb-4">
            <label class="form-label fw-bold" for="f_${id}" style="${penaltyStyle}">${field.label}</label>
            <textarea class="form-control" id="f_${id}" rows="3" placeholder="${field.placeholder || ''}" style="${penaltyStyle}">${value || ''}</textarea>
        </div>`;
    }

    // 2. All others: Grid Layout (Label Left, Input Right)
    let input = '';
    let labelContent = `<label class="form-label fw-bold mb-0" for="f_${id}">${field.label}</label>`;

    const isPenalty = field.kind === 'penalty';
    const penaltyStyle = isPenalty ? 'color: red !important; font-weight: bold;' : '';

    if (field.type === 'boolean') {
        const checked = value === true ? 'checked' : '';
        input = `<div class="form-check form-switch d-flex justify-content-end mb-0">
                    <input class="form-check-input" type="checkbox" id="f_${id}" style="transform: scale(1.4);" ${checked}>
                 </div>`;
    }
    else if (field.type === 'range') {
        const currentVal = value !== null ? value : Math.ceil((field.max||5)/2);
        input = `<div class="d-flex align-items-center">
                    <input type="range" class="form-range flex-grow-1" id="f_${id}" min="${field.min||0}" max="${field.max||5}" value="${currentVal}" oninput="document.getElementById('d_${id}').innerText=this.value">
                    <span class="fw-bold ms-2" id="d_${id}" style="min-width:1.5em; text-align: right; ${isPenalty ? 'color: red !important;' : 'color: var(--bs-primary);'}">${currentVal}</span>
                 </div>`;
    }
    else if (field.type === 'timed' || field.type === 'stopwatch') {
        // Parse "MM:SS"
        let mm = '';
        let ss = '';
        if (value && typeof value === 'string' && value.includes(':')) {
            [mm, ss] = value.split(':');
        }

        // Label col gets the Start button
        labelContent = `<div class="d-flex justify-content-between align-items-center w-100">
                            <label class="form-label fw-bold mb-0" for="f_${id}" style="${penaltyStyle}">${field.label}</label>
                            <button type="button" class="btn btn-success btn-sm mb-0 p-0 fw-bold d-flex align-items-center justify-content-center" style="width: 80px; height: 38px;" onclick="startStopwatch('${id}')">START</button>
                        </div>`;

        // Input col gets the mm:ss edit fields
        input = `<div class="input-group input-group-sm">
                    <input type="number" class="form-control text-center px-1" id="f_${id}_mm" placeholder="MM" inputmode="numeric" pattern="[0-9]*" onchange="app.combineTime('${id}')" value="${mm}" style="${penaltyStyle}">
                    <span class="input-group-text px-1">:</span>
                    <input type="number" class="form-control text-center px-1" id="f_${id}_ss" placeholder="SS" inputmode="numeric" pattern="[0-9]*" onchange="app.combineTime('${id}')" value="${ss}" style="${penaltyStyle}">
                 </div><input type="hidden" id="f_${id}_val" value="${value || ''}">`;
    }
    else if (field.type === 'number') {
        input = `<input type="number" class="form-control form-control-sm" id="f_${id}" inputmode="numeric" pattern="[0-9]*" placeholder="${field.placeholder || ''}" value="${value !== null ? value : ''}" style="${penaltyStyle}">`;
    }
    else if (field.type === 'select') {
        input = `<select class="form-select form-select-sm" id="f_${id}" style="${penaltyStyle}">${(field.options||[]).map(o=> {
            const selected = (o === value) ? 'selected' : '';
            return `<option value="${o}" ${selected}>${o}</option>`;
        }).join('')}</select>`;
    }
    else {
        input = `<input type="text" class="form-control form-control-sm" id="f_${id}" value="${value || ''}" style="${penaltyStyle}">`;
    }

    if (field.type !== 'timed' && field.type !== 'stopwatch' && field.type !== 'textarea') {
         labelContent = `<label class="form-label fw-bold mb-0" for="f_${id}" style="${penaltyStyle}">${field.label}</label>`;
    }

    return `<div class="row py-2 border-bottom align-items-center">
                <div class="col-8">
                    ${labelContent}
                </div>
                <div class="col-4">
                    ${input}
                </div>
            </div>`;
}