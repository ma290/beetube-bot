const _ = require("lodash");
const axios = require("axios");
const Provider = require(".");
const Paginator = require("../models/paginator");
const keyboardMarkup = require("../utils/keyboard");

module.exports = class Movie extends Provider {
	constructor(bot) {
		super(bot);
		this.type = "movie";
		this.endpoint = process.env.GOPHIE_API;
	}

	/**
	 * List movies
	 * @param  {} message
	 * @param  {} page=1
	 */
	async list({ chat }, page = 1) {
		const { message_id } = await this.bot.sendMessage(
			chat.id,
			"\u{1F4E1} Fetching latest movies",
			keyboardMarkup
		);

		await this.bot.sendChatAction(chat.id, "upload_video");
		const { data } = await axios.get(`${this.endpoint}/list`, {
			params: { page, engine: "fzmovies" },
		});

		_.map(data, (movie, i) => {
			if (movie.Size && movie.CoverPhotoLink) {
				const options = { parse_mode: "html" };
				const isLastItem = data.length - 1 === i;
				/*
				 * Ensure all messages are sent before pagination
				 */
				setTimeout(
					async () => {
						const pagination = isLastItem
							? [
									{
										text: "Next",
										callback_data: JSON.stringify({
											type: `paginate_${this.type}`,
											page: page + 1,
										}),
									},
							  ]
							: [];

						if (page > 1 && pagination.length > 0) {
							pagination.unshift({
								text: "Previous",
								callback_data: JSON.stringify({
									type: `paginate_${this.type}`,
									page: page - 1,
								}),
							});
						}

						options.reply_markup = JSON.stringify({
							inline_keyboard: [
								[
									{
										text: `Download (${movie.Size})`,
										url: movie.DownloadLink,
									},
								],
								pagination,
							],
						});

						const description = movie.Description
							? `\n\n<b>Description:</b> <em>${movie.Description.slice(
									0,
									-6
							  )}</em>`
							: "";

						const msg = await this.bot.sendMessage(
							chat.id,
							`<a href="${movie.CoverPhotoLink}">\u{1F3AC}</a> <b>${movie.Title}</b>${description}`,
							options
						);

						await new Paginator({
							_id: msg.message_id,
							type: this.type,
							user: msg.chat.id,
						}).save();
					},
					isLastItem ? 2500 : 0
				);
			}
		});

		await this.bot.deleteMessage(chat.id, message_id);
	}

	/**
	 * Search for movies
	 * @param  {} message
	 * @param  {} params
	 */
	async search({ chat }, params) {
		const { message_id } = await this.bot.sendMessage(
			chat.id,
			`\u{1F4E1} Searching for \`${params.query}\``,
			keyboardMarkup
		);

		await this.bot.sendChatAction(chat.id, "upload_video");
		const { data } = await axios.get(`${this.endpoint}/search`, {
			params: {
				query: params.query.replace(" ", "+"),
				engine: "fzmovies",
			},
		});

		_.map(data, async movie => {
			if (movie.Size && movie.CoverPhotoLink) {
				const options = { parse_mode: "html" };
				options.reply_markup = JSON.stringify({
					inline_keyboard: [
						[{ text: `Download (${movie.Size})`, url: movie.DownloadLink }],
					],
				});

				const description = movie.Description
					? `\n\n<b>Description:</b> <em>${movie.Description.slice(0, -6)}</em>`
					: "";

				await this.bot.sendMessage(
					chat.id,
					`<a href="${movie.CoverPhotoLink}">\u{1F3AC}</a> <b>${movie.Title}</b>${description}`,
					options
				);
			}
		});

		await this.bot.deleteMessage(chat.id, message_id);
	}

	/**
	 * Interactive search
	 * @param  {} message
	 */
	async interactiveSearch(message) {
		const chatId = message.chat.id;
		const { message_id } = await this.bot.sendMessage(
			chatId,
			"\u{1F50D} Tell me the title of the movie you want",
			{ reply_markup: JSON.stringify({ force_reply: true }) }
		);

		const listenerId = this.bot.onReplyToMessage(
			chatId,
			message_id,
			async reply => {
				this.bot.removeReplyListener(listenerId);
				await this.search(message, { query: reply.text });
			}
		);
	}
};
