import React, { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// The Gemini API key can be provided in two ways:
//   1. A Vite env variable at build/dev time  ->  create a ".env" file with
//      VITE_GEMINI_API_KEY=your_key  (see .env.example)
//   2. The in-app Settings dialog, which stores the key in the browser's
//      localStorage only (it never leaves the user's machine except to call
//      the Gemini API directly).
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';
const LS_KEY_STORE = 'nutriscanner_api_key';
const LS_MODEL_STORE = 'nutriscanner_model';

const getApiKey = () =>
  ENV_API_KEY || localStorage.getItem(LS_KEY_STORE) || '';

const getModel = () =>
  localStorage.getItem(LS_MODEL_STORE) || DEFAULT_MODEL;

// This is the main App component for our food analysis tool.
const App = () => {
  // State to manage the user's selected image file.
  const [imageFile, setImageFile] = useState(null);
  // State to manage the URL for the image preview.
  const [imagePreview, setImageFilePreview] = useState(null);
  // State to store analysis results from the Gemini API.
  const [analysisResult, setAnalysisResult] = useState(null);
  // State to manage loading status during an API call.
  const [isLoading, setIsLoading] = useState(false);
  // State to store any error messages.
  const [error, setError] = useState(null);
  // State to manage whether the live camera is active.
  const [isScanning, setIsScanning] = useState(false);
  // State to hold the live video stream object.
  const [videoStream, setVideoStream] = useState(null);
  // State to manage the current page view (home, about, privacy, etc.).
  const [currentPage, setCurrentPage] = useState('home');
  // State to manage the visibility of the dropdown menu.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // State to track which recipe is currently expanded.
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  // State to manage the visibility of the API key settings dialog.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Temporary values edited inside the settings dialog.
  const [settingsKey, setSettingsKey] = useState('');
  const [settingsModel, setSettingsModel] = useState('');
  // Whether an API key is currently available (env var or saved).
  const [hasApiKey, setHasApiKey] = useState(() => getApiKey().length > 0);

  // References for the video and canvas elements.
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // This useEffect handles stopping the camera stream when isScanning becomes false or the component unmounts.
  useEffect(() => {
    // Function to stop the camera stream.
    const stopCamera = () => {
      if (videoStream) {
        // Stop all video tracks to fully release the camera.
        videoStream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);
      }
    };

    // Clean up the stream when the component unmounts or isScanning state changes.
    if (!isScanning) {
      stopCamera();
    }

    // A cleanup function that will be called on unmount.
    return () => {
      stopCamera();
    };
  }, [isScanning, videoStream]);

  // This new useEffect handles video playback when the videoStream state changes.
  // It's a more robust way to ensure the video element is ready.
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch((err) => {
        // Handle play() promise rejection (e.g., if the user hasn't interacted with the page yet).
        console.error('Video play failed:', err);
      });
    }
  }, [videoStream]);

  // Close the dropdown menu when clicking outside of it or pressing Escape.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Revoke preview object URLs when they are replaced to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Function to start the live camera stream.
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setVideoStream(stream);
      setIsScanning(true);
    } catch (err) {
      console.error('Camera access denied or failed:', err);
      // Inform the user about the camera permission issue.
      setError(
        'Camera access was denied or an error occurred. Please ensure your browser has camera permissions.'
      );
      setIsScanning(false);
    }
  };

  // Function to handle image selection from the user's device.
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // If a file is selected, stop the camera if it's on.
      setIsScanning(false);
      setImageFile(file);
      setImageFilePreview(URL.createObjectURL(file));
      // Reset any previous analysis results and errors.
      setAnalysisResult(null);
      setError(null);
    }
  };

  // Function to capture an image from the live video stream.
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert the canvas image to a Blob.
      canvas.toBlob((blob) => {
        if (blob) {
          // Create a File object from the blob to mimic an uploaded file.
          const capturedFile = new File([blob], 'captured-image.jpg', {
            type: 'image/jpeg',
          });
          setImageFile(capturedFile);
          setImageFilePreview(URL.createObjectURL(capturedFile));
          setIsScanning(false); // Stop camera after capture.
          setAnalysisResult(null);
          setError(null);
        } else {
          setError('Failed to capture image from video stream.');
        }
      }, 'image/jpeg');
    }
  };

  // Function to convert an image file to a Base64 string.
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Settings dialog helpers -------------------------------------------------
  const openSettings = () => {
    // Pre-fill with the saved (not env) values so the user can edit them.
    setSettingsKey(localStorage.getItem(LS_KEY_STORE) || '');
    setSettingsModel(localStorage.getItem(LS_MODEL_STORE) || DEFAULT_MODEL);
    setIsMenuOpen(false);
    setIsSettingsOpen(true);
  };

  const saveSettings = () => {
    if (settingsKey.trim()) {
      localStorage.setItem(LS_KEY_STORE, settingsKey.trim());
    } else {
      localStorage.removeItem(LS_KEY_STORE);
    }
    if (settingsModel.trim()) {
      localStorage.setItem(LS_MODEL_STORE, settingsModel.trim());
    } else {
      localStorage.removeItem(LS_MODEL_STORE);
    }
    setHasApiKey(getApiKey().length > 0);
    setIsSettingsOpen(false);
    setError(null);
  };

  const clearSettings = () => {
    localStorage.removeItem(LS_KEY_STORE);
    localStorage.removeItem(LS_MODEL_STORE);
    setSettingsKey('');
    setSettingsModel(DEFAULT_MODEL);
    setHasApiKey(getApiKey().length > 0);
  };

  // Function to handle the analysis process by calling the Gemini API.
  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('Please upload or scan an image first.');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError(
        'A Gemini API key is required. Open Settings (menu in the top-right corner) and paste your key — get a free one at aistudio.google.com.'
      );
      setIsSettingsOpen(true);
      setSettingsKey(localStorage.getItem(LS_KEY_STORE) || '');
      setSettingsModel(localStorage.getItem(LS_MODEL_STORE) || DEFAULT_MODEL);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const model = getModel();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const base64Data = await fileToBase64(imageFile);

      // Define the system instruction for the model.
      const systemInstruction =
        'You are a nutrition and food analysis expert. Your job is to analyze a product image and provide its nutritional value, harmful ingredients, and a healthier substitute. When exact information is not available from the image, you must leverage your general food knowledge to provide a reasonable estimation. Your response must be in JSON format.';

      // The main user prompt for the model.
      const userPrompt =
        "Analyze this product image and provide its calories, harmful ingredients (if any), and a better alternative (low-calorie or healthier). For the alternative, provide a detailed name, a clear reason why it is a better choice, and a few tips for how to incorporate it. For harmful ingredients, provide a name and a short reason. If exact calories are not visible, provide a reasonable estimate based on the food type and common serving sizes. Provide the answer in JSON format only, without any additional text. Use 'N/A' only if no information or reasonable estimate can be provided.";

      // JSON schema to ensure the model returns a structured response.
      const responseSchema = {
        type: 'OBJECT',
        properties: {
          productName: { type: 'STRING', description: 'The name of the product.' },
          calories: {
            type: 'STRING',
            description:
              'Calories or energy value per serving/100g. Provide an estimate if exact value is not visible.',
          },
          harmfulIngredients: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                reason: { type: 'STRING' },
              },
            },
            description:
              'List of harmful ingredients with a reason (e.g., high fructose corn syrup, artificial sweeteners, etc.).',
          },
          substitute: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'The name of the healthier substitute.' },
              reason: { type: 'STRING', description: 'A detailed reason why it is a better choice.' },
              tips: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'A few tips for how to use or incorporate the substitute.',
              },
            },
          },
        },
        required: ['productName', 'calories', 'harmfulIngredients', 'substitute'],
      };

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: imageFile.type || 'image/jpeg',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      };

      // API call with exponential backoff for robustness.
      let response;
      let attempt = 0;
      const maxAttempts = 5;
      while (attempt < maxAttempts) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            break;
          }

          // Don't retry client errors (bad key, invalid model, etc.) — only transient ones.
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            const errBody = await response.json().catch(() => null);
            const apiMessage = errBody?.error?.message;
            if (response.status === 400 || response.status === 403) {
              throw new Error(
                `Gemini API rejected the request${apiMessage ? `: ${apiMessage}` : ''}. Check that your API key is valid in Settings.`
              );
            }
            if (response.status === 404) {
              throw new Error(
                `Model "${model}" was not found. Open Settings and try "gemini-3.5-flash", "gemini-3.5-flash-lite", or "gemini-3-flash-preview".`
              );
            }
            throw new Error(apiMessage || 'API call failed.');
          }
        } catch (e) {
          // Re-throw our descriptive errors immediately instead of retrying.
          if (e instanceof TypeError) {
            // Network failure — fall through to retry.
          } else {
            throw e;
          }
        }
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        attempt++;
      }

      if (!response || !response.ok) {
        throw new Error('API call failed.');
      }

      const result = await response.json();
      const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        throw new Error('No data received in the response.');
      }

      const parsedJson = JSON.parse(jsonText);
      setAnalysisResult(parsedJson);
    } catch (e) {
      console.error('Analysis Error:', e);
      setError(
        e?.message && e.message !== 'API call failed.'
          ? e.message
          : 'An error occurred during analysis. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Hardcoded data for healthy recipes
  const healthyRecipes = [
    {
      name: 'Classic Avocado Sandwich',
      description: 'A fresh and simple sandwich packed with healthy fats and fiber.',
      ingredients: [
        '2 slices whole-wheat or multigrain bread',
        '1 ripe avocado',
        '1/2 tsp red pepper flakes (optional)',
        'Squeeze of fresh lemon juice',
        'Salt and black pepper to taste',
        'Handful of fresh spinach or arugula',
        'Thinly sliced cucumber or tomato (optional)',
      ],
      instructions: [
        'Lightly toast the bread slices to your desired crispiness.',
        'In a small bowl, mash the avocado with a fork. Mix in the lemon juice, red pepper flakes, salt, and pepper.',
        'Spread the mashed avocado mixture evenly over one slice of the toasted bread.',
        'Layer the fresh spinach or arugula on top of the avocado. If using, add the sliced cucumber or tomato.',
        'Top with the second slice of toast, cut in half, and serve immediately. Enjoy!',
      ],
    },
    {
      name: 'Sheet Pan Lemon Herb Chicken and Veggies',
      description:
        'An easy and delicious one-pan meal that’s perfect for a healthy weeknight dinner.',
      ingredients: [
        '4 boneless, skinless chicken breasts or thighs',
        '2 large carrots, chopped',
        '1 head broccoli, cut into florets',
        '1 red onion, chopped into wedges',
        '2 zucchini, chopped',
        '1/4 cup olive oil',
        'Juice of 1 large lemon',
        '2 tbsp fresh or 1 tsp dried rosemary',
        '2 tbsp fresh or 1 tsp dried thyme',
        '2 cloves garlic, minced',
        'Salt and black pepper to taste',
      ],
      instructions: [
        'Preheat your oven to 400°F (200°C).',
        'In a large bowl, combine the chopped carrots, broccoli, red onion, and zucchini.',
        'In a separate small bowl, whisk together the olive oil, lemon juice, minced garlic, rosemary, thyme, salt, and pepper.',
        'Pour half of the oil and herb mixture over the vegetables and toss to coat evenly.',
        'Place the chicken pieces in the same bowl and coat them with the remaining mixture.',
        'Arrange the vegetables and chicken in a single layer on a large sheet pan, ensuring they are not overcrowded.',
        'Bake for 20-25 minutes, or until the chicken is cooked through and the vegetables are tender and slightly caramelized. Serve immediately.',
      ],
    },
  ];

  // This function toggles the expanded recipe view.
  const handleRecipeClick = (recipeName) => {
    setExpandedRecipe(expandedRecipe === recipeName ? null : recipeName);
  };

  // Defensive accessors for the AI result shape.
  const harmfulList = Array.isArray(analysisResult?.harmfulIngredients)
    ? analysisResult.harmfulIngredients
    : [];
  const substituteTips = Array.isArray(analysisResult?.substitute?.tips)
    ? analysisResult.substitute.tips
    : [];

  // A helper function to render a page.
  const renderPage = () => {
    switch (currentPage) {
      case 'about':
        return (
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-4">About Us</h2>
            <p className="text-gray-600 mb-4">
              Welcome to NutriScanner! Our mission is to empower you to make healthier food choices
              by providing quick and easy nutritional analysis. We believe that understanding what's
              in your food should be simple and accessible to everyone.
            </p>
            <p className="text-gray-600 mb-4">
              This application was built using a powerful AI model to analyze food product images
              and provide useful information like calorie counts, potential harmful ingredients, and
              suggestions for healthier alternatives.
            </p>
            <p className="text-gray-600">
              We are constantly working to improve our accuracy and functionality. Your feedback is
              highly appreciated!
            </p>
          </div>
        );
      case 'privacy':
        return (
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-4">
              Privacy Policy
            </h2>
            <p className="text-gray-600 mb-4">
              Your privacy is important to us. This application does not store any of your personal
              information or the images you upload.
            </p>
            <p className="text-gray-600 mb-4">
              The images you provide are sent directly to the AI model for analysis and are not
              saved on our servers. The analysis results are displayed to you in real-time and are
              not stored.
            </p>
            <p className="text-gray-600 mb-4">
              If you enter a Gemini API key in Settings, it is stored only in your own browser's
              local storage on your device — it is never sent anywhere except directly to Google's
              Gemini API to perform the analysis you request.
            </p>
            <p className="text-gray-600">
              By using this app, you agree to these terms. If you have any concerns, please stop
              using the application.
            </p>
          </div>
        );
      case 'terms':
        return (
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-4">
              Terms of Service
            </h2>
            <p className="text-gray-600 mb-4">
              Welcome to NutriScanner! By using this service, you agree to the following terms and
              conditions:
            </p>
            <ul className="list-disc pl-5 text-gray-600 space-y-2 mb-4">
              <li>The nutritional analysis provided by this app is for informational purposes only.</li>
              <li>
                The analysis is an estimate and should not be considered as a substitute for
                professional medical or nutritional advice.
              </li>
              <li>
                The information provided may not be 100% accurate, as it is based on AI model
                predictions and may not account for all product variations.
              </li>
              <li>You agree not to use this app for any illegal or unauthorized purposes.</li>
              <li>
                We are not liable for any health issues or other problems that may arise from using
                the information provided by this application.
              </li>
            </ul>
            <p className="text-gray-600">Your use of the app constitutes your acceptance of these terms.</p>
          </div>
        );
      case 'healthyRecipes':
        return (
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-4">
              Healthy Recipes
            </h2>
            <p className="text-gray-600 mb-6">
              Here are some delicious and healthy recipes and snack ideas to help you stay on track
              with your nutrition goals.
            </p>
            <div className="space-y-6">
              {healthyRecipes.map((recipe, index) => (
                <div
                  key={index}
                  className="bg-green-50 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
                  onClick={() => handleRecipeClick(recipe.name)}
                >
                  <h3 className="text-2xl font-bold text-green-700 mb-2">{recipe.name}</h3>
                  <p className="text-gray-600 text-sm mt-1 mb-4">{recipe.description}</p>
                  {expandedRecipe === recipe.name && (
                    <div className="mt-4 text-gray-800">
                      <h4 className="font-bold text-lg text-gray-800 mb-2">Ingredients:</h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {recipe.ingredients.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      <h4 className="font-bold text-lg text-gray-800 mt-6 mb-2">Instructions:</h4>
                      <ul className="list-none space-y-1 pl-4">
                        {recipe.instructions.map((step, i) => (
                          <li key={i} className="text-gray-700">
                            <span className="font-semibold">{i + 1}.</span> {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {expandedRecipe !== recipe.name && (
                    <p className="text-gray-800 font-semibold text-sm mt-4">
                      Click to see the full recipe...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'home':
      default:
        // This is the original home screen content
        return (
          <>
            <p className="text-center text-lg text-gray-500 mb-8">
              Upload or scan a product image to get its nutritional
              <br />
              information and a healthy alternative.
            </p>

            {/* API key hint when none is configured */}
            {!hasApiKey && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg mb-8">
                <p className="font-bold">API key needed</p>
                <p className="text-sm">
                  To analyze images, add your free Gemini API key in{' '}
                  <button
                    onClick={openSettings}
                    className="underline font-semibold hover:text-yellow-900"
                  >
                    Settings
                  </button>
                  . Get one at aistudio.google.com.
                </p>
              </div>
            )}

            {/* Main action and image preview area */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8">
              <label
                htmlFor="fileUpload"
                className="relative cursor-pointer w-full md:w-auto flex items-center justify-center py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                onClick={() => setIsScanning(false)}
              >
                <input
                  id="fileUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  ref={fileInputRef}
                />
                <span className="text-base">Upload Image</span>
              </label>
              <button
                onClick={startCamera}
                className="relative cursor-pointer w-full md:w-auto flex items-center justify-center py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                <span className="text-base">Live Scan</span>
              </button>
            </div>

            {/* Live video feed for scanning */}
            {isScanning && (
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="relative w-full max-w-sm aspect-square mb-6 overflow-hidden rounded-2xl border-4 border-dashed border-gray-300 bg-gray-50 p-2 flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-xl"
                  ></video>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="flex gap-4">
                  {/* Container for buttons below the square video feed */}
                  <button
                    onClick={handleCapture}
                    className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full text-base shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Capture
                  </button>
                  <button
                    onClick={() => setIsScanning(false)}
                    className="py-2 px-4 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-full text-base shadow-lg transition-all duration-300 transform hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {imagePreview && !isScanning && (
              <div className="relative w-full aspect-square mb-8 overflow-hidden rounded-2xl border-4 border-dashed border-gray-300 bg-gray-50 p-2 flex items-center justify-center shadow-inner">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              </div>
            )}

            {imageFile && !isScanning && (
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-6 w-6 text-white mx-auto"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  'Analyze'
                )}
              </button>
            )}

            {error && (
              <div
                className="bg-red-100 border-l-4 border-red-600 text-red-700 p-4 rounded-lg mb-8"
                role="alert"
              >
                <p className="font-bold">Error!</p>
                <p>{error}</p>
              </div>
            )}

            {/* Display results with better styling */}
            {analysisResult && (
              <div className="mt-8">
                {/* Product name banner */}
                {analysisResult.productName && (
                  <div className="mb-6 p-4 rounded-2xl shadow bg-gray-800 text-white text-center">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                      Detected product
                    </p>
                    <p className="text-2xl font-extrabold">{analysisResult.productName}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Calories Card with a more defined style */}
                  <div className="flex flex-col p-6 rounded-3xl shadow-xl bg-gradient-to-r from-blue-100 to-blue-50 transition-transform duration-300 hover:scale-[1.02]">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Calories</h3>
                    <p className="text-2xl font-extrabold text-blue-600">
                      {analysisResult.calories}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Approx calories are provided based on the most precise nutritional data
                      available for this food type.
                    </p>
                  </div>

                  {/* Harmful Ingredients Card */}
                  <div className="flex flex-col p-6 rounded-3xl shadow-xl bg-gradient-to-r from-red-100 to-red-50 transition-transform duration-300 hover:scale-[1.02]">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Harmful Ingredients</h3>
                    {harmfulList.length > 0 ? (
                      <ul className="list-disc list-inside text-red-700 space-y-1">
                        {harmfulList.map((item, index) => (
                          <li key={index} className="pl-0">
                            <span className="font-semibold">{item.name}</span>:{' '}
                            <span className="text-sm text-gray-600">{item.reason}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-green-600 font-bold text-lg">None detected!</p>
                    )}
                  </div>

                  {/* Healthy Substitute Card */}
                  {analysisResult.substitute && (
                    <div className="md:col-span-2 flex flex-col p-6 rounded-3xl shadow-xl bg-gradient-to-r from-green-100 to-green-50 transition-transform duration-300 hover:scale-[1.02]">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">Healthy Substitute</h3>
                      <p className="text-green-700 font-semibold text-lg mb-2">
                        {analysisResult.substitute.name}
                      </p>
                      <p className="text-gray-600 mb-4">{analysisResult.substitute.reason}</p>
                      {substituteTips.length > 0 && (
                        <>
                          <h4 className="font-bold text-gray-700 mb-1">Tips for Use:</h4>
                          <ul className="list-disc list-inside text-gray-600 space-y-1">
                            {substituteTips.map((tip, index) => (
                              <li key={index}>{tip}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4 font-sans antialiased">
      {/* Wrapper to center the content horizontally and vertically */}
      <div className="max-w-2xl mx-auto flex flex-col min-h-screen pb-16">
        {/* Container for header and menu */}
        <div className="w-full flex justify-between items-center z-10 mb-4">
          {/* Header */}
          <div className="flex items-center space-x-2">
            <img
              src="/logo.png"
              alt="NutriScanner logo"
              className="h-10 w-10 md:h-12 md:w-12 rounded-xl shadow-sm"
            />
            <h1
              className="flex items-center text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight cursor-pointer"
              onClick={() => setCurrentPage('home')}
            >
              NutriScanner
            </h1>
          </div>

          {/* Menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
              aria-expanded={isMenuOpen}
              className="p-2 rounded-full font-semibold transition-colors duration-300 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {/* Hamburger SVG Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                <button
                  onClick={() => {
                    setCurrentPage('home');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('about');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  About Us
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('privacy');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('terms');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Terms of Service
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('healthyRecipes');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Healthy Recipes
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={openSettings}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                    {!hasApiKey && (
                      <span className="ml-auto inline-block h-2 w-2 rounded-full bg-yellow-400"></span>
                    )}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main content card */}
        <div className="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          {/* Render the selected page content */}
          {renderPage()}
        </div>
      </div>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-extrabold text-gray-800">Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close settings"
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="apiKeyInput">
              Gemini API key
            </label>
            <input
              id="apiKeyInput"
              type="password"
              autoComplete="off"
              placeholder="AIza..."
              value={settingsKey}
              onChange={(e) => setSettingsKey(e.target.value)}
              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-800"
            />
            <p className="text-xs text-gray-500 mb-4">
              {ENV_API_KEY
                ? 'An API key is also configured via the VITE_GEMINI_API_KEY environment variable, which takes priority.'
                : 'Get a free key at '}
              {!ENV_API_KEY && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-700 font-semibold underline"
                >
                  aistudio.google.com
                </a>
              )}
              . Stored only in your browser.
            </p>

            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="modelInput">
              AI model
            </label>
            <input
              id="modelInput"
              type="text"
              placeholder={DEFAULT_MODEL}
              value={settingsModel}
              onChange={(e) => setSettingsModel(e.target.value)}
              className="w-full mb-2 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-800"
            />
            <p className="text-xs text-gray-500 mb-6">
              Default: {DEFAULT_MODEL}. Alternatives: gemini-3.5-flash-lite, gemini-3-flash-preview.
            </p>

            <div className="flex gap-3">
              <button
                onClick={saveSettings}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow transition-colors"
              >
                Save
              </button>
              <button
                onClick={clearSettings}
                className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The footer is now fixed at the bottom of the viewport */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-gray-500 text-sm bg-gray-50 bg-opacity-90 z-20">
        NutriScanner &copy; {new Date().getFullYear()} All rights reserved.
      </footer>
    </div>
  );
};

export default App;
