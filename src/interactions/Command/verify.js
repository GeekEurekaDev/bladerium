const { CommandInteraction, Client, MessageActionRow, MessageButton } = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
const Discord = require('discord.js');
const axios = require('axios');
const moment = require('moment-timezone');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox account')
        .addStringOption(option => option.setName('username').setDescription('Enter your Roblox username').setRequired(true)),
    /** 
     * @param {Client} client
     * @param {CommandInteraction} interaction
     * @param {String[]} args
     */

    run: async (client, interaction, args) => {
        await interaction.deferReply({ fetchReply: true });
    
        const username = interaction.options.getString('username');
        const member = interaction.guild.members.cache.get(interaction.user.id);

        const role = interaction.guild.roles.cache.get('1229249912604987392');

        if (!role) {
            return interaction.followUp('The verification role does not exist in this guild.');
        }

        // Check if the user already has the role
        if (member.roles.cache.has(role.id)) {
            return interaction.followUp('You are already verified.');
        }

         const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        });
        const userId = response.data.data[0].id;

        const avatarResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const avatarUrl = avatarResponse.data.data[0].imageUrl;


        // Ask the user a series of questions
        const questions = [
            { text: `Is this your Roblox profile? (yes/no)`, imageUrl: avatarUrl },
            'What\'s your profile link?',
            'What\'s your timezone?',
            'How did you find the group?',
            'Are you pending to the Roblox group? (yes/no)'
        ];
        const answers = [];

        let lastMessage = null;
        for (let i = 0; i < questions.length; i++) {
            const questionEmbed = new Discord.EmbedBuilder()
                .setDescription(typeof questions[i] === 'string' ? questions[i] : questions[i].text)
                .setColor('#808080');
        
            if (typeof questions[i] !== 'string') {
                questionEmbed.setImage(questions[i].imageUrl);
            }

            if (lastMessage) {
                await lastMessage.reply({ embeds: [questionEmbed] });
            } else {
                await interaction.followUp({ embeds: [questionEmbed] });
            }
        
            const filter = m => m.author.id === interaction.user.id;
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
            const answer = collected.first().content;

            if (i === 0 && answer.toLowerCase() !== 'yes') {
                return interaction.followUp('Username verification failed. Please ensure your username is correct and try again.');
            }

            // If this is the first question and the answer doesn't include 'www.roblox.com/users/', return an error
            if (i === 1 && !answer.includes('www.roblox.com/users/')) {
                return interaction.followUp('Invalid profile link. Please ensure it includes "www.roblox.com/users/" and try again.');
            }
        
            answers.push(answer);
            lastMessage = collected.first();
        }
        

        // If the user answered 'no' to the last question, tell them to request to join the group
        if (answers[3].toLowerCase() === 'no') {
            return interaction.followUp('Please request to join the [group](https://www.roblox.com/groups/12960473/Chosen-Devils#!/about) and try again.');
        }

        function generateRandomWords() {
            const words = ['book', 'chair', 'door', 'food', 'home', 'light', 'water', 'window', 'table'];
        
            for (let i = words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [words[i], words[j]] = [words[j], words[i]];
            }
        
            return words.join(' ');
        }
        
        // Usage
        const word = generateRandomWords();
        
        // Create a button
        const row = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('done')
                    .setLabel('Done!')
                    .setStyle(1),
            );

        // Send an embed with the word
        const wordEmbed = new Discord.EmbedBuilder()
        .setTitle('Verification')
        .setDescription(`Please add the following word to your Roblox bio: \`${word}\``)
        .setColor('#808080');
    
      const message = await interaction.followUp({ embeds: [wordEmbed], components: [row] });
    
        // Create a message collector
        const filter = i => i.customId === 'done' && i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (buttonInteraction) => {
            await buttonInteraction.deferUpdate();

            const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [username]
            });

            const userId = response.data.data[0].id;
            const userResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
    
            if (userResponse.data.description.includes(word)) {

                const groupResponse = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);

                const blacklistedGroups = [3630491, 32326026, 34107403, 13085492, 34004959, 16357730];
                const isMemberOfBlacklistedGroup = groupResponse.data.data.some(item => blacklistedGroups.includes(item.group.id));
                if (isMemberOfBlacklistedGroup) {
                    // Message the user
                    await member.user.send('You are a member of a blacklisted group.');
            
                    // Kick the user from the server
                    await member.kick('User is a member of a blacklisted group.');
            
                    return;
                }

                await member.roles.add(role);
            
                const interviewEmbed = new Discord.EmbedBuilder()
                .setTitle(`Interview Responses for ${member.user.tag}`)
                .setDescription(`1. Username: ${username}\n2. Profile link: ${answers[1]}\n3. Timezone: ${answers[2]}\n4. How they found the group: ${answers[3]}\n5. Pending to the Roblox group: ${answers[4]}`)
                .setColor('#808080');
            
            
                const interviewChannel = client.channels.cache.get('1229250225651060827');
                interviewChannel.send({ embeds: [interviewEmbed] });
            
                await interaction.followUp('Verification successful! Role has been added.');
            
                const specificGroupResponse = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
                const userSpecificGroup = specificGroupResponse.data.data.find(item => item.group.id === 12960473);
    
                if (userSpecificGroup) {
                    // Get the role corresponding to the user's rank in the group
                    let correspondingRole;
                    switch (userSpecificGroup.role.rank) {
                        case 19:
                            console.log('Role: Debiruzurīdā | デビルズリダー');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729700409456`);
                            break;
                        case 18:
                            console.log('Role: Satan | サタン');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729700409455`);
                            break;
                        case 17:
                            console.log('Role: Arudinakku | アルジナク');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729700409454`);
                            break;
                        case 15:
                            console.log('Role: Devil\'s Whisperer | 悪魔の囁き');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729700409453`);
                            break;
                        case 14:
                            console.log('Role: Devil\'s Advocate | 悪魔の代弁者');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729700409452`);
                            break;
                        case 13:
                            console.log('Role: Messenjā | メッセンジャー');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729696210962`);
                            break;
                        case 12:
                            console.log('Role: Bumon | ブモン');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729696210961`);
                            break;
                        case 11:
                            console.log('Role: Senden-sha | 宣伝者');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1228110666267627530`);
                            break;
                        case 8:
                            console.log('Role: Yami no Akuma | 地獄の王子たち');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729696210957`);
                            break;
                        case 7:
                            console.log('Role: Jisō-zūmi | 実相水');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729696210956`);
                            break;
                        case 6:
                            console.log('Role: Kachigāru | 価値がある');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729696210955`);
                            break;
                        case 5:
                            console.log('Role: Burazāren | ブラザーレン');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1228110189828509696`);
                            break;
                        case 3:
                            console.log('Role: Takumina | タクミナ');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729679564870`);
                            break;
                        case 2:
                            console.log('Role: Saikin | さいきん');
                            correspondingRole = interaction.guild.roles.cache.find(role => role.id === `1227591729679564869`);
                            break;
                        default:
                            console.log('No corresponding role found.');
                            break;
                    }
                
                    if (correspondingRole) {
                        await member.roles.add(correspondingRole);
                    }
                } 
            } else {
                await interaction.followUp('Verification failed. Please ensure the word is in your Roblox bio and try again.');
            }
        });
    },
};