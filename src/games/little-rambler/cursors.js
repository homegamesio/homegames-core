const { Asset } = require('squish-150');

// Original 40px cursor artwork. Editable SVGs and matching transparent PNGs
// live in ./cursors. PNG bytes are embedded for hosted and browser-local games.
// The hotspot is expressed in output pixels, at the pointer tip or held object.
const CURSORS = {
    "default": {
        "assetKey": "rambler_cursor_default",
        "hotspot": {
            "x": 5,
            "y": 4
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAACxLAAAsSwGlPZapAAAESUlEQVRYhe2Xa0wUVxTHp8Gk6Zf2g0lj035qaDKzGpsmrX3EOxMtyjoXtIKjtptiYt21GB+1Xan1FdoVQpW2IS4tjWzTBJCnritsuyQSHi5Id1E/gFQQKSC+kt2FYJvQKJ7mXmbG2WVpLdlXU09yssnszdzf/M89/znDMI/j/xasiNo4zPexmM9iJCmJSbTgRH6CwzyQZEXUn3CgLEa9BO6tjasgIUE5kW8kUK0tZeBqtIFoXKeCciI/yGLeJAjCvLgBsiKyEZhauxVgvAumxjyJBcphlEsgrD/kUcCznlIYGfo5cUDZVWgL2Xz/ETMF7LvqAEuNGcqbjsKd0bPxB9WJgp5sumWvkQLCuBccp3fDiSoTHK7dA3WtRRC41RI/UBYLi8hm2CTJgF3Q25QLA+VrwVq9k6qZX5cDzo4SuHvHHXvQF1NSniGbvJq5QgW87++Ei5XvwYWKDZBX8wmFJFlwci80eW0w6TsfW1DFrCduulVIb2cxVdFRuVkFtMhZaN8H7ZfK4J7fExtQxaz7expUQKKSs9oIA+UZUFy1YwakpcYMRY6DcKGnCqbGvNEFVcz6XGu5CjhtOcehq2LjjFJbQvJb5xfQ22enDRYV0FCzVpI0xXe1u2YttSUkbY35MHjNOX2OA16oPnUMXlmbon2Fts1NQYw+Jzc4ZjscBEiyvr2YwoWW+qh9H5S68qkNkcYhpSZwQ/0/QY3dCtsOZgfByemOiFlr03ejGfJqzWqpv6zLoTDaNVcvN8DxsiNg+HgTLEwTgqBYzF/mMCrQpQlLGYZ5IkJmHZzVzd9QTxyoyIDr7vyg/wy7NwUDifwfrIgcLBaMbCp6bk5Aj2LW2hz5zQVn3MXg6yyEwYpMmByqV/9LN62XlUKXWBHhF6Q3nmJiYdbh8sGYB0brs+G6Yys8CPxCr3W4K5VOnYiYYo9q1uHyzxEnDJ7IhIDna/XatgPZSpfaogYYzqyV9A83w7rtBnj3oyxqHwROW+rhPhe8vGYZUXFqYRr/WlQAZzNrArd66/Q54zAPpxtKwpb6q5JcudSoY87d+m/NOghORD7yq/8gk6o4KZd6zFtE1/5+ux0EQ7q8Vng/6pO1f6QF1ny4QYH79SW8/HkO81cUFcmaie5SuNvzo/pAjvrvlbN4O1m/5OmIAmrNOhROJwoL6BrMZ5FrqZsz4L7fE6bLvRpfRAURBVTMWtph0Ja1e/GKN59VF0lSEvkk1aoYmt0X7fLbBE3q0oXkiAEqZv1wAnmoXPA6/m9VJEmqIN/jTMTNOqxy2pD+WUXfcAsskVbSe5HKRAySTBscRt5Z4UJUVDo6HOShwhz1YZmYhzS7igM9DWD8zKSdAc/FHpCZeRbHR9uoWS9evUwZswIs5j9N1uufjAsgo1HRnLcLXl+fqkw19zjMW9l33p7PxDtYWUXNt4dLp1+qYxImJCmJvHvJoEFmwXjjPI7/RPwFlwJ6hhwzCB4AAAAASUVORK5CYII="
    },
    "pet": {
        "assetKey": "rambler_cursor_pet",
        "hotspot": {
            "x": 20,
            "y": 24
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "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"
    },
    "pat": {
        "assetKey": "rambler_cursor_pat",
        "hotspot": {
            "x": 20,
            "y": 24
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "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"
    },
    "pick": {
        "assetKey": "rambler_cursor_pick",
        "hotspot": {
            "x": 26,
            "y": 10
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAACxLAAAsSwGlPZapAAAFWklEQVRYhe2Yf0zUZRzHb7Na9Ue5tbZWbbZm8nxvbi2v1Nk9z1cD4e75IudxHIFwFIK/MEY0amDOQUyNNmBNvQPLUmr+am5haNRSNNSh0qAlZoASWeQPfk0lTcRP+3y557ifInfn1R8923sw+PJ5Xvd+Pj8evhrN/8tzPRsT8yhRWCnh7BThbIgo7LDmv7KmGvSPE07bJYWBEOHst3+PyGqdRAzybK1C01ASl2sR6mWbEYy5Zicg3RJxrqetsx+SOF0tcXrZ3S2hxLeT4aXU2FFAhZkjCheVMOdJibMfBMw8kwFsFouquaY4T1hOO9DlCDvHVLh5ZgM0bKiAofYGGGiphwNZhaqqbTnAEkbdkxTaOUWWH4wYoITHqjCQTXHQ31oPMNisarD1Gxcgau/iAhckUWhRROBkWb5P4rQXN91sy1FdQ/faHA44uKTIAxBVlbFCHPWliBxzFKdzRM55wwTSPGdOYqXfc0A5PSEzZ/UK2Pj+u3CyuMyva95KtyQ6W42cGjaQ503yZMLpWpwARKG78dPDYHPOzd7j10XOoa7/2ghntnwEB7IDg6YJQEWfEha4qDj5GcJZt3urKK8qHnYH81abwz7uEUtcPytkOJ1Odz/hrBUDLsrPgKZjO8Hx6Xq41XfCBdPZVjdc+1U1DHV/Py6gwzZaJERhF8NSJJLC8jCgMdsC1y4cVTe/2dvk7tahFy2xpfhMtIVDi30TtNkdfo+4NrMAqGm+GHWFIcORhdGPEYX1Y8BDDTUuqNsDo19H+k9AY8NncyVOfxJHj30OW4k/58bg2PGwNGpJYRsx4JKipX7zrOvn/d0CzpidBKblr7pyFPPMlpSoyn3UIZyWy0+EDKc16LVEocPTF8yFzlN1LqiLXQdc3xdXFKruJixLhr7uBrhxqQnsW9cB/o33RQFzDo81bCNO4qweA5d+uMrDtZLKInhn/VuqtPGyC078fnNNmbgQdE3jcnqUkS3Cap1ikic/p7zyVFjgCKcKbjIrOQ4Gfh+rzCs9jaBLjHG54g3357nvYIbz98TI5qu3aK7PJwrtdHOzB++IoQEq9DQGq9lV4eHe1h3lAeFgsBnySnLFRaCFcGonnF4Vz8+0xgJLjx878ni9HBycUT8NA+gXcRjuPe4BYMiyBIQ72rjdJ+8wBbIKs+FgwzYYGRjtm5s+WSdSYFuQ7jEzBsD56l21afmvQdIbaT5wqAVLk11gmAYllYVwtm2fz3Nf138s7oR7ggKM4vR1DLCqrCDgGAM/QvjYxWY1Da70HPH7DP7cnJMiPkheUIASZ8kYAPNpIoAwjjAFcBo5p0g73sKDAiSKXodB4pcl+2wy2FIFvUfXwvAF3yMOJKxsUTzORt0aUrvRWrUPEIX1YbCzp/d7Adrh3HarqqFfdt4RDOc19sQZidGisoclzjZg/KDhXC5y5sCgldXv+WyM7v2xLxfObU+CG121AQFT3rT5VLXog1FGagkN0CDPFtV4vuNbn81H+o5B955MOL93OcDAyYBF4w7m0Qc5G8FRGhKkxNkODLZwRSrc6veFuHq6Bs5+boa/Or6YULEUVxSG57o11TDzETGivqyr8tnodl8TdO1KhUuHSyYEuHJNjnMU0pWaUBdRWAYGwwniz8XBFrta2XcD9vflJvhg0xpRMNfwhVJ4XgI530r5cxHuUj8271HblnPE3ZI4NWnCtcZzEe4gvB+WVxXD9AWyuBO2heUfJY9ltU6SFHZGQAZoHeBPL5ijXVUrKbRaF697WHMvlnAxGBG8uoXdNf8uHhGblu4uGFfi2ci+xQoCUBPJFcwRayK5CKeNE8o/ThuD3esff/SIH6fWrtsAAAAASUVORK5CYII="
    },
    "oat": {
        "assetKey": "rambler_cursor_oat",
        "hotspot": {
            "x": 18,
            "y": 16
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAACxLAAAsSwGlPZapAAAE30lEQVRYhe2XfVBUVRTAN/urmfqzZpo+/igd3lusUcdpSLl3hRB37337hXyIgEDFR36CHw1irlKAK6UoCGl+xAZlkYQhjcofiYU0A2jhRDaSSQ5p1qQOWhaOnua83bfsLiAs70H/cGbO7HvnzZ77e+ece+55Ot2kTMqkjJ+EGiOeFTkpEBjpFhk5p2fhK/Rxhod1/6eEWOY8opcM6QKnJ0VO74mcgq8KjFwXGNkaaiVPTRzVJt2UEEYjREZcAie3FJgZVgrLls2H+m0S1Dg5xKZFDoBy2i9y8lGIyTB7vPEeEDltwUXnLDJBYk4KlFeug9NN78CN713wT88RuPtHC/zbewx+b3bA8XILZC+Ngulmg29UvxI4teOLak4nGulMXOTb9k8BbnSMqP2/NsmgbXtt8MbaaJhtGwAVOflGc0CBUQc6//nsITlSGLGbXS641rYDrjZvhN4vlkPPoWQZCuECQbtcdtjpMMIsqxsUN5amgCKnHej4kxIOF2rs99cPYwaB3r54WH6WlhklA+o5SdIMTlhAHsedOsNigB9ctpEBawJAe4/D7Yv1ss2Zb1RSvUs7QG7IQKdpWVGjh6sZWg9vl9yAjJ7WDFBkpAGdvlvAggZq3CJBo9PsvccMhErYfsgdTZr5k3FhDwmM/qWXKLTttfov7jRDfZEEP1UPnfZzVXYozzXBQYd/3UrJ7j4pSOEG1YCCKVxCZ5aUyEEA9YUSlOWYoHbz0JAnSi3yc/z1ta/LjVb6Yp56QE53o7Oi9QsGASAUwpXlmGTYwOcYOYwgRtLXvr+QKYCfqwdk9BI6w+IeKo0IWV/kX2e+JYA1GGj/ssLiOQbJFdWAIift6My4OALO7POvwUA9854Vagv4kLCKnq+2Q0qGuxdib1UNONUY/qjIyVl0GJ0YAe0BG0XRhi1mKMs1yYrXwwHmr3bXn8jpNb3ZMFU14GghG51mOXoYxeHg9rzprj1Rwj5I+jQDHC3khfvokVIzPG92DwssI1YZGpw6LeWZ+S8+JjLaFyxk624rhC2cJ0MV7siH6o9LtT/uUPTcEIeOn7O4FwtWU9akwZ0/2wYiKJEETQEFRirlI6+qGJJWpwYFxzNi4eaVFviuvc7TA+klXVzcg/jpMI1HPqENICc70fn7B7f5DaefNVTCTLu3dXjtyv165xqvbeuujQrgL6g+L3FZ9QgWYiIL5fp72Q63fjvlB9nd1Qi21xIhKTfVa8PrhFUp8PfVVq8tKs3mF9kX4qKBJnsmHNXn8ybdFJHRTnS0cvNyuHe9fVTjP/goQkcuscqRxHQrPioOFHvGMOJSFUWR02n4SYnOdlc5gwaEYfTosX1K66lTBeiBZCKjd0MlA5xsrlYN13e5BexLFylpXqUaUIZkdINSQz0/Hh0zHP7XnBmvTDfncf7U8DuZ1KHj6eZ5sobFG8GSlQBZG7LknVtS4YD9NSXyLm8+8QF0dtRBb3eTd9Ng9PEFPZ8AnZq1G0Wwh4mMtI6laUen2wFLRKk79KUbLxE9i+YdWAE5FdmQvf1VSC9OhcWOJIh5PR74yhh4KdMCc5eYYFbsQL/EOsZSwWyMG5wv4Fu1a0fUzLdfUYbVftxs4wo2FsDYvAQlrRUTAhcsYGSG2TMohNsmHFAMQvXS3KcnDFBg5OsgAU8Fu8Z/6UugPD3sQP8AAAAASUVORK5CYII="
    },
    "berry": {
        "assetKey": "rambler_cursor_berry",
        "hotspot": {
            "x": 18,
            "y": 17
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "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"
    },
    "magnet": {
        "assetKey": "rambler_cursor_magnet",
        "hotspot": {
            "x": 20,
            "y": 7
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAACxLAAAsSwGlPZapAAADD0lEQVRYhe1WS08TURQel/4DSVyZqDOgadyIEWYGXKjMbeMj0SYaEHwsNIos0JgIMSWiCzaIKxONQRegiQvRhaiISX0AmUQDEaoi3SFPKaVqQe0x3+1QaZsGOy1lND3Jl5yce893vzm95/QKQpqMAnoO+fRmjoCeI1jNyKc3339wjQD4gtWMfHrniZrjBMAXrGaUFWiuIZ5EMKVPPmy7SgD8qLVMN858Q1TVnYoAwoZanCEA/sK1jDeO9QUGLP4TW6aLRU12S0yhxSBqsjtWYDK5pgX+zQGSgViByeSmLJB8ekJIf/ZE/dUlk5sZgYHox4LlBAppzM0KhGUrCEtlVEiZHDOWF9h7sTwhpEUEmsn9fwWOPGvhsKzA4GcPBYbeWEigpvhB0O0q44Rzk17ye15HHbJ1T3H4VbJDjrz34COGtUTiwMkFaoo/lQp6QPLo/AFO+n3YQ1+90RU8VLozLJDJd3I1dRUAHzGsJRIITqOCHtMCRaZ0gKS5ej8nnX7npp/Tw9RbXxE56HHNQdrkKArFjg7EsJZIIDjDH6Z0pCBQrgXJyQrGSYfbbxLN+ejTrfq4apSXllD+7mIO+PNVTwRwGpWvNS1wnV0VQbJ5VxH11JVRf2Ml/fo2ToFBPaqKvUkCXOAEN84wLZBX0Xi6nz3m4OSjna28imPue6YFgivl5/685bECm8jkH3l2hW5XO6nv0mHyD7zkIqf7X9DH67VxAgZvXKCpt0/jZiYADnBxTlZgE9JhEpNd+GKbXQ3hcvddPkrjr9ooFPzChc6ODdLM+y6a+dBNcxNeHgsFJ2mkszWuMWx21Wgk2SWk00QmN4E4lylUdcROXa4yGrhymkaf3+V3cnZiiANCcQ0GGisjwrAXOcg1GqNJWAJbIWryOYnJwfAYUfmhLWecpNeFB/lCIIY17MFeo2pBcIBLWCpbX6JslDSlXWJKZPZtcKik7t1GDud2DviILZiLIeQgV8iU5WmKJDKlQdTkHlz42EGNWHhNacBeYTlt9b4tK9eywjWSVpgPwEdsWUVl7V+x396/fwzFZEQmAAAAAElFTkSuQmCC"
    },
    "cast": {
        "assetKey": "rambler_cursor_cast",
        "hotspot": {
            "x": 20,
            "y": 7
        },
        "size": {
            "width": 40,
            "height": 40
        },
        "data": "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"
    }
};

function decode(source) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(128);
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;
    const bytes = new Uint8Array(source.length / 4 * 3 - (source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0));
    let at = 0;
    for (let i = 0; i < source.length; i += 4) {
        const value = lookup[source.charCodeAt(i)] << 18 | lookup[source.charCodeAt(i + 1)] << 12 |
            lookup[source.charCodeAt(i + 2)] << 6 | lookup[source.charCodeAt(i + 3)];
        if (at < bytes.length) bytes[at++] = value >> 16 & 255;
        if (at < bytes.length) bytes[at++] = value >> 8 & 255;
        if (at < bytes.length) bytes[at++] = value & 255;
    }
    return bytes;
}

function cursorAssets() {
    return Object.fromEntries(Object.values(CURSORS).map(cursor =>
        [cursor.assetKey, new Asset({ id: cursor.assetKey, type: 'image' }, decode(cursor.data))]));
}

// Kinds: default, pet, pat, pick, oat, berry, magnet, cast. Unknown kinds use
// the leaf pointer. A null kind restores the system cursor on exit/disconnect.
function cursorDescriptor(kind = 'default') {
    if (kind === null) return null;
    const cursor = Object.prototype.hasOwnProperty.call(CURSORS, kind) ? CURSORS[kind] : CURSORS.default;
    return { assetKey: cursor.assetKey, hotspot: { ...cursor.hotspot }, size: { ...cursor.size } };
}

module.exports = { cursorAssets, cursorDescriptor };
