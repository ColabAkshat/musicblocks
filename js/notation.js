class Notation {
    constructor(logo) {
        this._logo = logo;

        this._notationStaging = {};
        this._notationDrumStaging = {};
        this._pickupPOW2 = {};
        this._pickupPoint = {};
    }

    /*
    =======================================================
     Setters, Getters
    =======================================================
     */

    /**
     * @param {Object.<String[]>} notationStaging
     */
    set notationStaging(notationStaging) {
        this._notationStaging = notationStaging;
    }

    /**
     * @returns {Object.<String[]>}
     */
    get notationStaging() {
        return this._notationStaging;
    }

    /**
     * @param {Object.<String[]>} notationDrumStaging
     */
    set notationDrumStaging(notationDrumStaging) {
        this._notationDrumStaging = notationDrumStaging;
    }

    /**
     * @returns {Object.<String[]>}
     */
    get notationDrumStaging() {
        return this._notationDrumStaging;
    }

    /**
     * @returns {Object.<Boolean>}
     */
    get pickupPOW2() {
        return this._pickupPOW2;
    }

    /**
     * @returns {Object.<Number>}
     */
    get pickupPoint() {
        return this._pickupPoint;
    }

    /*
    =======================================================
     Notation Utility
    =======================================================
     */

    /**
     * Sets the notation markup.
     *
     * @param turtle
     * @param markup
     * @param {boolean} below
     * @returns {void}
     */
    _notationMarkup(turtle, markup, below) {
        if (below) {
            this._notationStaging[turtle].push("markdown", markup);
        } else {
            this._notationStaging[turtle].push("markup", markup);
        }

        this._pickupPoint[turtle] = null;
    }

    /**
     * Updates the music notation used for Lilypond output.
     *
     * @param note
     * @param {number} duration
     * @param turtle
     * @param insideChord
     * @param drum
     * @returns {void}
     */
    doUpdateNotation(
        note,
        duration,
        turtle,
        insideChord,
        drum
    ) {
        let obj = durationToNoteValue(duration);

        this._notationStaging[turtle].push([
            note,
            obj[0],
            obj[1],
            obj[2],
            obj[3],
            insideChord,
            this._logo.staccato[turtle].length > 0 && last(this._logo.staccato[turtle]) > 0
        ]);

        // If no drum is specified, add a rest to the drum line.
        // Otherwise, add the drum.
        if (drum.length === 0) {
            this._notationDrumStaging[turtle].push([
                ["R"],
                obj[0],
                obj[1],
                obj[2],
                obj[3],
                insideChord,
                false
            ]);
        } else if (["noise1", "noise2", "noise3"].indexOf(drum[0]) === -1) {
            let drumSymbol = getDrumSymbol(drum[0]);
            this._notationDrumStaging[turtle].push([
                [drumSymbol],
                obj[0],
                obj[1],
                obj[2],
                obj[3],
                insideChord,
                false
            ]);
        }

        this._pickupPoint[turtle] = null;

        if (typeof note === "object") {
            // If it is hertz, add a markup
            let markup = "";
            try {
                for (let i = 0; i < note.length; i++) {
                    if (typeof note[i] === "number") {
                        if ((markup = "")) {
                            markup = toFixed2(note[i]);
                            break;
                        }
                    }
                }

                if (markup.length > 0) {
                    this._notationMarkup(turtle, markup, false);
                }
            } catch (e) {
                console.debug(e);
            }
        }
    }

    /**
     * Adds a voice if possible.
     *
     * @param turtle
     * @param {number} arg
     * @returns {void}
     */
    notationVoices(turtle, arg) {
        switch (arg) {
            case 1:
                this._notationStaging[turtle].push("voice one");
                break;
            case 2:
                this._notationStaging[turtle].push("voice two");
                break;
            case 3:
                this._notationStaging[turtle].push("voice three");
                break;
            case 4:
                this._notationStaging[turtle].push("voice four");
                break;
            default:
                this._notationStaging[turtle].push("one voice");
                break;
        }

        this._pickupPoint[turtle] = null;
    }

    /**
     * Sets the key and mode in the notation.
     *
     * @param turtle
     * @param key
     * @param mode
     * @returns {void}
     */
    notationKey(turtle, key, mode) {
        this._notationStaging[turtle].push("key", key, mode);
        this._pickupPoint[turtle] = null;
    }

    /**
     * Sets the meter.
     *
     * @param turtle
     * @param count
     * @param value
     * @returns {void}
     */
    notationMeter(turtle, count, value) {
        if (this._pickupPoint[turtle] != null) {
            // Lilypond prefers meter to be before partials.
            let d = this._notationStaging[turtle].length - this._pickupPoint[turtle];
            let pickup = [];

            for (let i in d) {
                pickup.push(this._notationStaging[turtle].pop());
            }

            this._notationStaging[turtle].push("meter", count, value);

            for (let i in d) {
                this._notationStaging[turtle].push(pickup.pop());
            }
        } else {
            this._notationStaging[turtle].push("meter", count, value);
        }

        this._pickupPoint[turtle] = null;
    }

    /**
     * Adds swing.
     *
     * @param turtle
     * @returns {void}
     */
    notationSwing(turtle) {
        this._notationStaging[turtle].push("swing");
    }

    /**
     * Sets the tempo.
     *
     * @param turtle
     * @param {number} bpm - number of beats per minute
     * @param beatValue
     * @returns {void}
     */
    notationTempo(turtle, bpm, beatValue) {
        let beat = convertFactor(beatValue);
        if (beat !== null) {
            this._notationStaging[turtle].push("tempo", bpm, beat);
        } else {
            let obj = rationalToFraction(beatValue);
            // this.errorMsg(_('Lilypond cannot process tempo of ') + obj[0] + '/' + obj[1] + ' = ' + bpm);
        }
    }

    /**
     * Adds a pickup.
     *
     * @param turtle
     * @param {number} factor
     * @returns {void}
     */
    notationPickup(turtle, factor) {
        if (factor === 0) {
            console.debug("ignoring pickup of 0");
            return;
        }

        let pickupPoint = this._notationStaging[turtle].length;

        // Lilypond partial must be a combination of powers of two.
        let beat = convertFactor(factor);
        if (beat !== null) {
            this._notationStaging[turtle].push("pickup", beat);
            this._pickupPOW2[turtle] = true;
        } else {
            if (this._logo.runningLilypond) {
                obj = rationalToFraction(factor);
                this._logo.errorMsg(
                    _("Lilypond cannot process pickup of ") +
                    obj[0] +
                    "/" +
                    obj[1]
                );
            }

            obj = rationalToFraction(1 - factor);
            for (let i = 0; i < obj[0]; i++) {
                this._logo.updateNotation(["R"], obj[1], turtle, false, "");
            }
        }

        this._pickupPoint[turtle] = pickupPoint;
    }

    /**
     * Sets tuning as harmonic.
     *
     * @param turtle
     * @returns {void}
     */
    __notationHarmonic(turtle) {
        this._notationStaging.push("harmonic");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Adds a line break.
     *
     * @param turtle
     * @returns {void}
     */
    notationLineBreak(turtle) {
        // this._notationStaging[turtle].push('break');
        this._pickupPoint[turtle] = null;
    }

    /**
     * Begins the articulation of an instrument.
     *
     * @param turtle
     * @returns {void}
     */
    notationBeginArticulation(turtle) {
        this._notationStaging[turtle].push("begin articulation");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Ends articulation.
     *
     * @param turtle
     * @returns {void}
     */
    notationEndArticulation(turtle) {
        this._notationStaging[turtle].push("end articulation");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Begins a crescendo or descrendo.
     *
     * @param turtle
     * @param {number} factor - If more than 0, we have a crescendo
     * (otherwise, a decrescendo)
     * @returns {void}
     */
    notationBeginCrescendo(turtle, factor) {
        if (factor > 0) {
            this._notationStaging[turtle].push("begin crescendo");
        } else {
            this._notationStaging[turtle].push("begin decrescendo");
        }

        this._pickupPoint[turtle] = null;
    }

    /**
     * Ends a crescendo or descrendo.
     *
     * @param turtle
     * @param {number} factor - If more than 0, we have a crescendo
     * (otherwise, a decrescendo)
     * @returns {void}
     */
    notationEndCrescendo(turtle, factor) {
        if (factor > 0) {
            this._notationStaging[turtle].push("end crescendo");
        } else {
            this._notationStaging[turtle].push("end decrescendo");
        }

        this._pickupPoint[turtle] = null;
    }

    /**
     * Begins a slur.
     *
     * @param turtle
     * @returns {void}
     */
    notationBeginSlur(turtle) {
        this._notationStaging[turtle].push("begin slur");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Ends a slur.
     *
     * @param turtle
     * @returns {void}
     */
    notationEndSlur(turtle) {
        this._notationStaging[turtle].push("end slur");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Adds a tie.
     *
     * @param turtle
     * @returns {void}
     */
    notationInsertTie(turtle) {
        this._notationStaging[turtle].push("tie");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Removes the last tie.
     *
     * @param turtle
     * @returns {void}
     */
    notationRemoveTie(turtle) {
        this._notationStaging[turtle].pop();
        this._pickupPoint[turtle] = null;
    }

    /**
     * Begins harmonics.
     *
     * @param turtle
     * @returns {void}
     */
    notationBeginHarmonics(turtle) {
        this._notationStaging[turtle].push("begin harmonics");
        this._pickupPoint[turtle] = null;
    }

    /**
     * Ends harmonics.
     *
     * @param turtle
     * @returns {void}
     */
    notationEndHarmonics(turtle) {
        this._notationStaging[turtle].push("end harmonics");
        this._pickupPoint[turtle] = null;
    }
}
