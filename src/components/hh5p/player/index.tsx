import React, {
  useEffect,
  useState,
  FunctionComponent,
  useMemo,
  useRef,
  useContext,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { unescape } from "html-escaper";

// import "./index.css";
import Loader from "./../loader";

import { EditorContext } from "./../context";

import type { XAPIEvent, PlayerProps } from "h5p-headless-player";

export const Player: FunctionComponent<PlayerProps> = ({ id, onXAPI }) => {
  const [height, setHeight] = useState<number>(100);
  const iFrameRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const { state, getContentConfig } = useContext(EditorContext);

  useEffect(() => {
    getContentConfig &&
      getContentConfig(id)
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
  }, [id, getContentConfig]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data.iFrameHeight) {
        setHeight(event.data.iFrameHeight);
      }
      if (event.data.statement) {
        onXAPI && onXAPI(event.data as XAPIEvent);
      }
    };

    window && window.addEventListener("message", onMessage);
    return () => {
      window && window.removeEventListener("message", onMessage);
    };
  }, [iFrameRef, state, onXAPI, id]);

  const src = useMemo(() => {
    const settings = state.value === "loaded" && state.settings;
    if (!settings) return "";

    const content =
      state.value === "loaded" && state.settings?.contents
        ? state.settings?.contents[Object.keys(state.settings?.contents)[0]]
        : null;

    const embedType = content?.content.library.embedTypes;

    const markup = renderToStaticMarkup(
      <html>
        <head>
          <style>{`
          body, html {margin:0; padding:0;}
          iframe { border:none; margin:0; padding:0; }
          `}</style>
          <script>
            {`const H5PIntegration = window.H5PIntegration = ${JSON.stringify(
              settings
            )}; `}
          </script>
          {[...settings.core.scripts, ...settings.loadedJs].map((script) => (
            <script key={script} src={script}></script>
          ))}
          {[...settings.core.styles, ...settings.loadedCss].map((style) => (
            <link
              type="text/css"
              rel="stylesheet"
              key={style}
              href={style}
            ></link>
          ))}
          <script>
            {`H5P.getCrossOrigin = function (source) { return "anonymous" }`}
          </script>
        </head>
        <body>
          <div className="h5p-player-wrapper h5p-resize-observer">
            {(embedType && embedType === "div") ||
              (embedType === "" && (
                <div className="h5p-content" data-content-id={id}></div>
              ))}
            {embedType && embedType === "iframe" && (
              <div className="h5p-iframe-wrapper">
                <iframe
                  id={`h5p-iframe-${id}`}
                  className="h5p-iframe"
                  data-content-id={id}
                  src="about:blank"
                  frameBorder="0"
                  scrolling="no"
                  title="player"
                ></iframe>
              </div>
            )}

            <script>
              {`
            (function ($) {
                const replacerFunc = () => {
                    const visited = new WeakSet();
                    return (key, value) => {
                      if (value.nodeType) return;
                      if (typeof value === "object" && value !== null) {
                        if (visited.has(value)) {
                          return;
                        }
                        visited.add(value);
                      }
                      return value;
                    };
                  };
                const postMessage = (data) => parent.postMessage(data, "${window.location.origin}");
                const resizeObserver = new ResizeObserver((entries) =>
                    postMessage({ iFrameHeight: entries[0].contentRect.height })
                );
                resizeObserver.observe(document.querySelector(".h5p-resize-observer"));
                H5P.externalDispatcher.on('xAPI', function (event) {
                    try {
                      postMessage(event.data, replacerFunc())
                    } catch(err) {
                      console.error(event, err)
                    }
                });
            })(H5P.jQuery);
            `}
            </script>
          </div>
        </body>
      </html>
    );

    return window.URL.createObjectURL(
      new Blob([unescape(markup).split("&#x27;").join("'")], {
        type: "text/html",
      })
    );
  }, [state, id]);

  return (
    <div className="h5p-player" style={{ height: height }}>
      {loading && <Loader />}
      <iframe ref={iFrameRef} title="player" src={src}></iframe>
    </div>
  );
};

export default Player;
