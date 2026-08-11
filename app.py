from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)

# Conversion factor: 1 unit = X meters
UNIT_TO_METER = {
    'millimeter': 0.001,
    'centimeter': 0.01,
    'meter': 1,
    'kilometer': 1000,
    'inch': 0.0254,
    'feet': 0.3048,
}

UNIT_LABELS = {
    'millimeter': 'Millimeter (mm)',
    'centimeter': 'Centimeter (cm)',
    'meter': 'Meter (m)',
    'kilometer': 'Kilometer (km)',
    'inch': 'Inch (in)',
    'feet': 'Feet (ft)',
}


@app.route('/')
def index():
    return render_template('index.html', units=UNIT_LABELS)


@app.route('/sw.js')
def service_worker():
    # Served from the root (not /static/) so its default scope covers the whole app,
    # letting it control every page instead of just files under /static/.
    response = send_from_directory('static', 'sw.js', mimetype='application/javascript')
    response.headers['Cache-Control'] = 'no-cache'
    return response


@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')


@app.route('/api/convert', methods=['POST'])
def convert():
    data = request.get_json(silent=True) or {}
    try:
        value = float(data.get('value'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Please enter a valid numeric value.'}), 400

    from_unit = data.get('from_unit')
    to_unit = data.get('to_unit')

    if from_unit not in UNIT_TO_METER or to_unit not in UNIT_TO_METER:
        return jsonify({'error': 'Invalid unit selected.'}), 400

    meters = value * UNIT_TO_METER[from_unit]
    result = meters / UNIT_TO_METER[to_unit]

    return jsonify({'result': result})


def _compute_perimeter_area(length, breadth, input_unit, output_unit):
    """Compute perimeter and area for one rectangle, converted to output_unit."""
    perimeter_input = 2 * (length + breadth)
    area_input = length * breadth

    # Linear conversion factor between input unit and output unit.
    factor = UNIT_TO_METER[input_unit] / UNIT_TO_METER[output_unit]

    perimeter = perimeter_input * factor
    area = area_input * (factor ** 2)  # area scales with the square of the linear factor
    return perimeter, area


@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.get_json(silent=True) or {}
    try:
        length = float(data.get('length'))
        breadth = float(data.get('breadth'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Please enter valid numeric length and breadth.'}), 400

    input_unit = data.get('input_unit')
    output_unit = data.get('output_unit', input_unit)

    if input_unit not in UNIT_TO_METER or output_unit not in UNIT_TO_METER:
        return jsonify({'error': 'Invalid unit selected.'}), 400

    if length <= 0 or breadth <= 0:
        return jsonify({'error': 'Length and breadth must be greater than zero.'}), 400

    perimeter, area = _compute_perimeter_area(length, breadth, input_unit, output_unit)

    return jsonify({
        'perimeter': perimeter,
        'area': area,
        'input_unit': input_unit,
        'output_unit': output_unit,
    })


@app.route('/api/calculate_batch', methods=['POST'])
def calculate_batch():
    """
    Accepts multiple length/breadth entries (each with its own input unit)
    and a single output unit. Returns per-entry perimeter/area plus totals,
    all expressed in the output unit.

    Expected body:
    {
      "output_unit": "feet",
      "entries": [
        {"length": 10, "breadth": 4, "input_unit": "meter"},
        {"length": 3,  "breadth": 3, "input_unit": "centimeter"}
      ]
    }
    """
    data = request.get_json(silent=True) or {}
    output_unit = data.get('output_unit')
    entries = data.get('entries')

    if output_unit not in UNIT_TO_METER:
        return jsonify({'error': 'Invalid output unit selected.'}), 400

    if not isinstance(entries, list) or len(entries) == 0:
        return jsonify({'error': 'Add at least one length/breadth entry.'}), 400

    results = []
    total_perimeter = 0.0
    total_area = 0.0

    for i, entry in enumerate(entries, start=1):
        try:
            length = float(entry.get('length'))
            breadth = float(entry.get('breadth'))
        except (TypeError, ValueError):
            return jsonify({'error': f'Row {i}: enter valid numeric length and breadth.'}), 400

        input_unit = entry.get('input_unit')
        if input_unit not in UNIT_TO_METER:
            return jsonify({'error': f'Row {i}: invalid unit selected.'}), 400

        if length <= 0 or breadth <= 0:
            return jsonify({'error': f'Row {i}: length and breadth must be greater than zero.'}), 400

        perimeter, area = _compute_perimeter_area(length, breadth, input_unit, output_unit)

        total_perimeter += perimeter
        total_area += area

        results.append({
            'length': length,
            'breadth': breadth,
            'input_unit': input_unit,
            'perimeter': perimeter,
            'area': area,
        })

    return jsonify({
        'results': results,
        'total_perimeter': total_perimeter,
        'total_area': total_area,
        'output_unit': output_unit,
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
