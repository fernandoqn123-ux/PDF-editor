/*
========================================
CONFIGURAÇÃO DO PDF.JS
========================================
*/

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


/*
========================================
ELEMENTOS DA PÁGINA
========================================
*/

const fileInput =
    document.getElementById("fileInput");

const controls =
    document.getElementById("controls");

const empty =
    document.getElementById("empty");

const help =
    document.getElementById("help");

const pagesContainer =
    document.getElementById("pages");

const prevBtn =
    document.getElementById("prevBtn");

const nextBtn =
    document.getElementById("nextBtn");

const textInput =
    document.getElementById("textInput");

const fileNameInput =
    document.getElementById("fileNameInput");

const downloadBtn =
    document.getElementById("downloadBtn");

const pageInfo =
    document.getElementById("pageInfo");


/*
========================================
VARIÁVEIS
========================================
*/

let originalPdfBytes = null;

let pdfDocument = null;

let currentPage = 1;

let totalPages = 0;

let selectedPdfText = null;

let selectedPdfHighlight = null;

let pdfTextEdits = [];


/*
========================================
ABRIR PDF
========================================
*/

fileInput.addEventListener(
    "change",
    async function () {

        const file =
            fileInput.files[0];

        if (!file) {
            return;
        }

        try {

            originalPdfBytes =
                new Uint8Array(
                    await file.arrayBuffer()
                );

            pdfDocument =
                await pdfjsLib.getDocument({
                    data: originalPdfBytes.slice()
                }).promise;

            totalPages =
                pdfDocument.numPages;

            currentPage = 1;

            pdfTextEdits = [];

            selectedPdfText = null;

            selectedPdfHighlight = null;

            empty.classList.add(
                "hidden"
            );

            help.classList.remove(
                "hidden"
            );

            controls.style.display =
                "flex";

            await renderPage(
                currentPage
            );

        }

        catch (error) {

            console.error(
                "Erro ao abrir PDF:",
                error
            );

            alert(
                "Não foi possível abrir este PDF."
            );
        }
    }
);


/*
========================================
PÁGINA ANTERIOR
========================================
*/

prevBtn.addEventListener(
    "click",
    async function () {

        if (currentPage <= 1) {
            return;
        }

        currentPage--;

        selectedPdfText = null;

        selectedPdfHighlight = null;

        await renderPage(
            currentPage
        );
    }
);


/*
========================================
PRÓXIMA PÁGINA
========================================
*/

nextBtn.addEventListener(
    "click",
    async function () {

        if (
            currentPage >=
            totalPages
        ) {
            return;
        }

        currentPage++;

        selectedPdfText = null;

        selectedPdfHighlight = null;

        await renderPage(
            currentPage
        );
    }
);


/*
========================================
ALTERAR TEXTO SELECIONADO
========================================
*/

textInput.addEventListener(
    "input",
    function () {

        if (!selectedPdfText) {
            return;
        }

        selectedPdfText.text =
            textInput.value;
    }
);


/*
========================================
RENDERIZAR PÁGINA
========================================
*/

async function renderPage(
    pageNumber
) {

    pagesContainer.innerHTML =
        "";

    const page =
        await pdfDocument.getPage(
            pageNumber
        );

    const scale = 1.5;

    const viewport =
        page.getViewport({
            scale: scale
        });

    const pageWrapper =
        document.createElement(
            "div"
        );

    pageWrapper.className =
        "pdf-page";

    pageWrapper.style.width =
        viewport.width + "px";

    pageWrapper.style.height =
        viewport.height + "px";

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        viewport.width;

    canvas.height =
        viewport.height;

    const context =
        canvas.getContext(
            "2d"
        );

    await page.render({

        canvasContext:
            context,

        viewport:
            viewport

    }).promise;

    pageWrapper.appendChild(
        canvas
    );

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        "editor-overlay";

    pageWrapper.appendChild(
        overlay
    );

    pagesContainer.appendChild(
        pageWrapper
    );

    overlay.addEventListener(
        "click",
        testarSelecaoTexto
    );

    pageInfo.textContent =
        "Página " +
        pageNumber +
        " de " +
        totalPages;
}


/*
========================================
SUBSTITUIR TEXTO NO PDF
========================================
*/

async function substituirTextoPdf(
    pdf,
    pageNumber,
    textoOriginal,
    textoNovo,
    xOriginal,
    larguraOriginal
) {

    const page =
        pdf.getPage(
            pageNumber - 1
        );

    const chaveContents =
        [...page.node.dict.keys()]
            .find(
                chave =>
                    chave.encodedName ===
                    "/Contents"
            );

    if (!chaveContents) {
        return false;
    }

    const contentsRef =
        page.node.dict.get(
            chaveContents
        );

    const contentsObj =
        pdf.context.lookup(
            contentsRef
        );

    if (!contentsObj) {
        return false;
    }


    /*
    ====================================
    DESCOMPRIME O CONTENTS
    ====================================
    */

    const stream =
        new DecompressionStream(
            "deflate"
        );

    const writer =
        stream.writable.getWriter();

    writer.write(
        contentsObj.contents
    );

    writer.close();

    const dadosDescomprimidos =
        await new Response(
            stream.readable
        ).arrayBuffer();

    let conteudo =
        new TextDecoder(
            "latin1"
        ).decode(
            dadosDescomprimidos
        );


    /*
    ====================================
    LOCALIZA O TEXTO
    ====================================
    */

    const textoPdf =
        `[(${textoOriginal})] TJ`;

    if (
        !conteudo.includes(
            textoPdf
        )
    ) {
        return false;
    }


    /*
    ====================================
    CALCULA NOVA POSIÇÃO
    ====================================
    */

    const canvas =
        document.createElement("canvas");

    const ctx =
        canvas.getContext("2d");

    ctx.font =
        "18px sans-serif";

    const larguraOriginalCanvas =
        ctx.measureText(
            textoOriginal
        ).width;

    const larguraNovaCanvas =
        ctx.measureText(
            textoNovo
        ).width;

    const proporcao =
        larguraOriginal /
        larguraOriginalCanvas;

    const larguraNova =
        larguraNovaCanvas *
        proporcao;

    const centroOriginal =
        xOriginal +
        larguraOriginal / 2;

    const novoX =
        centroOriginal -
        larguraNova / 2;


    /*
    ====================================
    SUBSTITUI O TEXTO E A POSIÇÃO
    ====================================
    */

    const novoXTexto =
        novoX.toFixed(6);

    const textoOriginalEscapado =
        textoOriginal.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

    const padraoTexto =
        new RegExp(
            `BT\\s+${xOriginal.toFixed(6)}\\s+([\\d.-]+)\\s+Td\\s+\\[\\(${textoOriginalEscapado}\\)\\]\\s+TJ\\s+ET`
        );

    const substitutoTexto =
        `BT ${novoXTexto} $1 Td [(${textoNovo})] TJ ET`;

    conteudo =
        conteudo.replace(
            padraoTexto,
            substitutoTexto
        );


    /*
    ====================================
    COMPRIME NOVAMENTE
    ====================================
    */

    const dadosNovos =
        new TextEncoder().encode(
            conteudo
        );

    const compressor =
        new CompressionStream(
            "deflate"
        );

    const writerCompressao =
        compressor.writable.getWriter();

    writerCompressao.write(
        dadosNovos
    );

    writerCompressao.close();

    const dadosComprimidos =
        new Uint8Array(
            await new Response(
                compressor.readable
            ).arrayBuffer()
        );


    /*
    ====================================
    ATUALIZA O CONTENTS
    ====================================
    */

    contentsObj.contents =
        dadosComprimidos;

    return true;
}


/*
========================================
BAIXAR PDF
========================================
*/

async function downloadPdf() {

    if (!originalPdfBytes) {

        alert(
            "Abra um PDF primeiro."
        );

        return;
    }

    try {

        const pdf =
            await PDFLib.PDFDocument.load(
                originalPdfBytes
            );

        for (
            const edit of pdfTextEdits
        ) {

            const substituido =
                await substituirTextoPdf(
                    pdf,
                    edit.pageNumber,
                    edit.originalText,
                    edit.text,
                    edit.x,
                    edit.width
                );

            if (!substituido) {

                console.error(
                    "Não foi possível substituir:",
                    edit.originalText
                );
            }
        }

        const result =
            await pdf.save();

        const blob =
            new Blob(
                [result],
                {
                    type:
                        "application/pdf"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href =
            url;

        let fileName =
            fileNameInput.value.trim();

        if (!fileName) {
            fileName =
                "documento_editado";
        }

        if (
            !fileName
                .toLowerCase()
                .endsWith(".pdf")
        ) {
            fileName += ".pdf";
        }

        link.download =
            fileName;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );

    }

    catch (error) {

        console.error(
            "Erro ao gerar PDF:",
            error
        );

        alert(
            "Ocorreu um erro ao gerar o PDF."
        );
    }
}


/*
========================================
DOWNLOAD
========================================
*/

downloadBtn.addEventListener(
    "click",
    downloadPdf
);


/*
========================================
SELECIONAR TEXTO EXISTENTE DO PDF
========================================
*/

async function testarSelecaoTexto(event) {

    if (!pdfDocument) {
        return;
    }

    const page =
        await pdfDocument.getPage(
            currentPage
        );

    const textContent =
        await page.getTextContent();

    const overlay =
        document.querySelector(
            ".editor-overlay"
        );

    if (!overlay) {
        return;
    }

    const rect =
        overlay.getBoundingClientRect();

    const clickX =
        event.clientX -
        rect.left;

    const clickY =
        event.clientY -
        rect.top;

    for (
        const item of textContent.items
    ) {

        if (!item.str) {
            continue;
        }

        const x =
            item.transform[4] *
            1.5;

        const y =
            rect.height -
            (
                item.transform[5] *
                1.5
            );

        const width =
            item.width *
            1.5;

        const height =
            item.height *
            1.5;

        if (
            clickX >= x &&
            clickX <= x + width &&
            clickY >= y - height &&
            clickY <= y
        ) {


            /*
            ====================================
            REMOVE DESTAQUE ANTERIOR
            ====================================
            */

            if (selectedPdfHighlight) {

                selectedPdfHighlight.remove();

                selectedPdfHighlight =
                    null;
            }


            /*
            ====================================
            GUARDA O TEXTO SELECIONADO
            ====================================
            */

            let textoExistente =
                pdfTextEdits.find(
                    edit =>
                        edit.pageNumber ===
                            currentPage &&
                        edit.x ===
                            item.transform[4] &&
                        edit.y ===
                            item.transform[5]
                );

            if (!textoExistente) {

                textoExistente = {

                    pageNumber:
                        currentPage,

                    text:
                        item.str,

                    originalText:
                        item.str,

                    x:
                        item.transform[4],

                    y:
                        item.transform[5],

                    width:
                        item.width,

                    height:
                        item.height
                };

                pdfTextEdits.push(
                    textoExistente
                );
            }

            selectedPdfText =
                textoExistente;

            textInput.value =
                selectedPdfText.text;


            /*
            ====================================
            DESTAQUE VISUAL
            ====================================
            */

            const highlight =
                document.createElement(
                    "div"
                );

            highlight.className =
                "pdf-text-highlight";

            highlight.style.position =
                "absolute";

            highlight.style.left =
                x + "px";

            highlight.style.top =
                (
                    y -
                    height
                ) + "px";

            highlight.style.width =
                width + "px";

            highlight.style.height =
                height + "px";

            highlight.style.border =
                "2px solid #1769aa";

            highlight.style.background =
                "rgba(23, 105, 170, 0.15)";

            highlight.style.pointerEvents =
                "none";

            overlay.appendChild(
                highlight
            );

            selectedPdfHighlight =
                highlight;

            return;
        }
    }
}

