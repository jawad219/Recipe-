// ==========================================
// 🍳 RECIPE AI - WORKER VERSION
// ==========================================

// Tumhara Cloudflare Worker
const WORKER_URL =
    "https://new-recipy-api.jawadshahid136.workers.dev";

let customIngredients = [];
let generatedRecipes = [];
let currentLanguage = "roman";

let favorites =
    JSON.parse(
        localStorage.getItem("recipeFavorites") || "[]"
    );


// ==========================================
// ADD CUSTOM INGREDIENT
// ==========================================

function addCustomIngredient() {

    const input =
        document.getElementById("customIngredient");

    if (!input) return;

    const value =
        input.value.trim();

    if (!value) return;

    customIngredients.push(value);

    input.value = "";

    showCustomIngredients();
}


// ==========================================
// SHOW CUSTOM INGREDIENTS
// ==========================================

function showCustomIngredients() {

    const list =
        document.getElementById("customList");

    if (!list) return;

    list.innerHTML = "";

    customIngredients.forEach((item, index) => {

        const div =
            document.createElement("span");

        div.className = "custom-item";

        div.innerHTML = `
            🥕 ${escapeHTML(item)}

            <button
                onclick="removeCustomIngredient(${index})"
            >
                ×
            </button>
        `;

        list.appendChild(div);
    });
}


// ==========================================
// REMOVE CUSTOM INGREDIENT
// ==========================================

function removeCustomIngredient(index) {

    customIngredients.splice(index, 1);

    showCustomIngredients();
}


// ==========================================
// GET SELECTED INGREDIENTS
// ==========================================

function getSelectedIngredients() {

    const selected = [];

    document
        .querySelectorAll(".ingredient input:checked")
        .forEach(input => {

            selected.push(input.value);

        });

    customIngredients.forEach(item => {

        selected.push(item);

    });

    return selected;
}


// ==========================================
// GENERATE RECIPES
// ==========================================

async function generateRecipes() {

    const selected =
        getSelectedIngredients();

    const results =
        document.getElementById("results");


    // ======================================
    // NO INGREDIENTS
    // ======================================

    if (selected.length === 0) {

        results.innerHTML = `

            <div class="empty">

                <h3>
                    🥕 Ingredients select karein
                </h3>

                <p>
                    Pehle ingredients select
                    ya add karein.
                </p>

            </div>

        `;

        return;
    }


    // ======================================
    // LOADING
    // ======================================

    results.innerHTML = `

        <div class="empty">

            <h3>
                🤖 AI Recipe bana raha hai...
            </h3>

            <p>
                Ingredients analyze ho rahe hain.
            </p>

            <br>

            <p>
                ⏳ Please wait...
            </p>

        </div>

    `;


    const maxRetries = 4;


    // ======================================
    // AUTOMATIC RETRY
    // ======================================

    for (
        let attempt = 0;
        attempt <= maxRetries;
        attempt++
    ) {

        try {

            // Retry se pehle wait
            if (attempt > 0) {

                const waitTime =
                    Math.min(
                        2000 *
                        Math.pow(
                            2,
                            attempt - 1
                        ),
                        16000
                    );


                results.innerHTML = `

                    <div class="empty">

                        <h3>
                            🔄 AI busy hai...
                        </h3>

                        <p>
                            Automatic retry
                            ki ja rahi hai.
                        </p>

                        <br>

                        <p>
                            ⏳
                            ${Math.ceil(
                                waitTime / 1000
                            )}
                            seconds...
                        </p>

                    </div>

                `;


                await sleep(waitTime);

            }


            // ==================================
            // SEND REQUEST TO WORKER
            // ==================================

            const response =
                await fetch(
                    WORKER_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                ingredients:
                                    selected,

                                language:
                                    currentLanguage

                            })
                    }
                );


            // ==================================
            // READ RESPONSE
            // ==================================

            let data = null;

            try {

                data =
                    await response.json();

            } catch {

                data = null;

            }


            // ==================================
            // API / QUOTA ERROR
            // ==================================

            if (!response.ok) {

                const errorMessage =
                    data?.error ||
                    "Server error";


                const lowerError =
                    errorMessage.toLowerCase();


                // Quota / rate limit detect
                const quotaError =
                    response.status === 429 ||
                    lowerError.includes("quota") ||
                    lowerError.includes("rate limit") ||
                    lowerError.includes("resource exhausted") ||
                    lowerError.includes("too many requests");


                if (quotaError) {

                    results.innerHTML = `

                        <div class="empty">

                            <h3>
                                🚫 API Quota Limit
                            </h3>

                            <p>
                                Gemini API ka
                                quota ya rate limit
                                filhal khatam/busy hai.
                            </p>

                            <br>

                            <p>
                                ⏳ Thori der baad
                                dobara try karein.
                            </p>

                        </div>

                    `;

                    return;
                }


                // Temporary server errors
                const retryable =
                    [
                        408,
                        500,
                        502,
                        503,
                        504
                    ].includes(
                        response.status
                    );


                if (
                    retryable &&
                    attempt < maxRetries
                ) {

                    continue;

                }


                throw new Error(
                    errorMessage
                );

            }


            // ==================================
            // WORKER SUCCESS CHECK
            // ==================================

            if (
                !data ||
                data.success !== true
            ) {

                const errorMessage =
                    data?.error ||
                    "Recipe generate nahi hui.";


                const lowerError =
                    errorMessage.toLowerCase();


                if (
                    lowerError.includes("quota") ||
                    lowerError.includes("rate limit") ||
                    lowerError.includes("resource exhausted") ||
                    lowerError.includes("too many requests")
                ) {

                    results.innerHTML = `

                        <div class="empty">

                            <h3>
                                🚫 API Quota Limit
                            </h3>

                            <p>
                                API quota ya
                                rate limit khatam
                                ho gayi hai.
                            </p>

                            <br>

                            <p>
                                ⏳ Thori der baad
                                dobara try karein.
                            </p>

                        </div>

                    `;

                    return;
                }


                throw new Error(
                    errorMessage
                );

            }


            // ==================================
            // RECIPES RECEIVED
            // ==================================

            generatedRecipes =
                data.recipes || [];


            displayRecipes(
                generatedRecipes
            );


            return;


        } catch (error) {

            console.error(
                "Recipe AI Error:",
                error
            );


            // ==================================
            // CONNECTION ERROR
            // ==================================

            if (
                attempt < maxRetries
            ) {

                continue;

            }


            results.innerHTML = `

                <div class="empty">

                    <h3>
                        ❌ Connection Error
                    </h3>

                    <p>
                        AI server se connection
                        nahi ho saka.
                    </p>

                    <br>

                    <p>
                        🔄 Please dobara
                        Generate Recipes dabayein.
                    </p>

                </div>

            `;

        }

    }

}


// ==========================================
// DISPLAY RECIPES
// ==========================================

function displayRecipes(recipes) {

    const results =
        document.getElementById("results");

    if (!results) return;


    if (
        !recipes ||
        !recipes.length
    ) {

        results.innerHTML = `

            <div class="empty">

                <h3>
                    😕 Recipe nahi mili
                </h3>

                <p>
                    In ingredients ke saath
                    suitable recipe nahi mili.
                </p>

            </div>

        `;

        return;

    }


    results.innerHTML = `

        <h2 style="margin-bottom:15px;">
            🍽️ AI Recipes
        </h2>

    `;


    recipes.forEach(
        (recipe, index) => {

            const div =
                document.createElement(
                    "div"
                );

            div.className =
                "recipe";


            const favorite =
                isFavorite(recipe.name);


            let ingredientsHTML = "";

            (
                recipe.ingredients || []
            ).forEach(item => {

                ingredientsHTML += `
                    <li>
                        ${escapeHTML(item)}
                    </li>
                `;

            });


            let usingHTML = "";

            (
                recipe.usingUserIngredients || []
            ).forEach(item => {

                usingHTML += `
                    <li>
                        ${escapeHTML(item)}
                    </li>
                `;

            });


            let missingHTML = "";

            (
                recipe.missingIngredients || []
            ).forEach(item => {

                missingHTML += `
                    <li>
                        ${escapeHTML(item)}
                    </li>
                `;

            });


            let stepsHTML = "";

            (
                recipe.steps || []
            ).forEach(step => {

                stepsHTML += `
                    <li>
                        ${escapeHTML(step)}
                    </li>
                `;

            });


            div.innerHTML = `

                <div class="recipe-content">

                    <h2>
                        🍳
                        ${escapeHTML(
                            recipe.name ||
                            "Recipe"
                        )}
                    </h2>


                    <p class="recipe-description">

                        ${escapeHTML(
                            recipe.description ||
                            ""
                        )}

                    </p>


                    <div class="info">

                        <span class="badge">

                            ⏱️
                            ${escapeHTML(
                                recipe.time ||
                                "N/A"
                            )}

                        </span>


                        <span class="badge">

                            ⭐
                            ${escapeHTML(
                                recipe.difficulty ||
                                "Easy"
                            )}

                        </span>

                    </div>


                    <button
                        class="favorite-btn"
                        onclick="
                            toggleFavorite(${index})
                        "
                    >

                        ${
                            favorite
                                ? "❤️ Saved"
                                : "♡ Add to Favorites"
                        }

                    </button>


                    <h3>
                        🛒 Required Ingredients
                    </h3>


                    <ul>

                        ${
                            ingredientsHTML ||
                            "<li>None</li>"
                        }

                    </ul>


                    <h3>
                        ✅ Aapki Ingredients
                    </h3>


                    <ul>

                        ${
                            usingHTML ||
                            "<li>None</li>"
                        }

                    </ul>


                    <h3>
                        ⚠️ Missing Ingredients
                    </h3>


                    ${
                        missingHTML

                            ? `

                                <div class="missing-box">

                                    <ul>
                                        ${missingHTML}
                                    </ul>

                                </div>

                            `

                            : `

                                <p>
                                    ✅ Koi zaroori
                                    ingredient missing nahi.
                                </p>

                            `
                    }


                    <h3>
                        👨‍🍳 Step by Step
                    </h3>


                    <ol>

                        ${
                            stepsHTML ||
                            "<li>Instructions unavailable.</li>"
                        }

                    </ol>


                </div>

            `;


            results.appendChild(div);

        }
    );


    window.scrollTo({

        top:
            results.offsetTop - 20,

        behavior:
            "smooth"

    });

}


// ==========================================
// FAVORITES
// ==========================================

function isFavorite(name) {

    return favorites.some(
        item =>
            item.name === name
    );

}


function toggleFavorite(index) {

    const recipe =
        generatedRecipes[index];

    if (!recipe) return;


    const existing =
        favorites.findIndex(
            item =>
                item.name ===
                recipe.name
        );


    if (existing >= 0) {

        favorites.splice(
            existing,
            1
        );

    } else {

        favorites.push(recipe);

    }


    localStorage.setItem(
        "recipeFavorites",
        JSON.stringify(favorites)
    );


    displayRecipes(
        generatedRecipes
    );


    showFavorites();
}


// ==========================================
// SHOW FAVORITES
// ==========================================

function showFavorites() {

    const box =
        document.getElementById(
            "favorites"
        );

    if (!box) return;


    if (!favorites.length) {

        box.innerHTML = `
            <p>
                Abhi koi favorite recipe nahi.
            </p>
        `;

        return;

    }


    box.innerHTML = "";


    favorites.forEach(
        (recipe, index) => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "favorite-card";


            div.innerHTML = `

                <span>

                    ❤️
                    ${escapeHTML(
                        recipe.name
                    )}

                </span>


                <button
                    onclick="
                        removeFavorite(${index})
                    "
                >
                    ×
                </button>

            `;


            box.appendChild(div);

        }
    );
}


// ==========================================
// REMOVE FAVORITE
// ==========================================

function removeFavorite(index) {

    favorites.splice(
        index,
        1
    );


    localStorage.setItem(
        "recipeFavorites",
        JSON.stringify(favorites)
    );


    showFavorites();
}


// ==========================================
// SEARCH RECIPES
// ==========================================

function searchRecipes() {

    const input =
        document.getElementById(
            "searchRecipe"
        );

    if (!input) return;


    const query =
        input.value
            .toLowerCase()
            .trim();


    if (!query) {

        displayRecipes(
            generatedRecipes
        );

        return;

    }


    const filtered =
        generatedRecipes.filter(
            recipe => {

                const text =

                    (
                        recipe.name ||
                        ""
                    )
                    + " " +

                    (
                        recipe.description ||
                        ""
                    )
                    + " " +

                    (
                        recipe.ingredients ||
                        []
                    ).join(" ");


                return text
                    .toLowerCase()
                    .includes(query);

            }
        );


    displayRecipes(
        filtered
    );
}


// ==========================================
// LANGUAGE TOGGLE
// ==========================================

function toggleLanguage() {

    if (
        currentLanguage === "roman"
    ) {

        currentLanguage =
            "english";


        const header =
            document.getElementById(
                "headerText"
            );


        const title =
            document.getElementById(
                "ingredientTitle"
            );


        if (header) {

            header.textContent =
                "What can you make with your ingredients?";

        }


        if (title) {

            title.textContent =
                "🥕 Select Your Ingredients";

        }

    } else {

        currentLanguage =
            "roman";


        const header =
            document.getElementById(
                "headerText"
            );


        const title =
            document.getElementById(
                "ingredientTitle"
            );


        if (header) {

            header.textContent =
                "Apke ingredients se kya ban sakta hai?";

        }


        if (title) {

            title.textContent =
                "🥕 Ingredients Select Karein";

        }

    }

}


// ==========================================
// SLEEP
// ==========================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ==========================================
// START
// ==========================================

showCustomIngredients();
showFavorites();